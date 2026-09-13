import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const safeEqual = (a: string, b: string) => a.length === b.length && a.split('').every((char, index) => char === b[index]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed.', { status: 405 });
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return new Response('Webhook is not configured.', { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  if (!signature || !safeEqual(signature, expected)) return new Response('Invalid signature.', { status: 401 });
  try {
    const event = JSON.parse(raw) as { event?: string; created_at?: number; payload?: { subscription?: { entity?: { id?: string; status?: string } } } };
    const subscription = event.payload?.subscription?.entity;
    const subscriptionId = subscription?.id;
    if (!subscriptionId || !event.event) return new Response('Ignored.', { status: 200 });
    const admin = createClient(url, serviceKey);
    const { data: business } = await admin.from('business_subscriptions').select('business_id').eq('razorpay_subscription_id', subscriptionId).maybeSingle();
    const { data: household } = business ? { data: null } : await admin.from('personal_subscriptions').select('household_id').eq('razorpay_subscription_id', subscriptionId).maybeSingle();
    if (!business && !household) return new Response('Ignored.', { status: 200 });
    const status = ['subscription.authenticated', 'subscription.activated'].includes(event.event)
      ? 'active'
      : event.event === 'subscription.cancelled' ? 'cancelled'
      : event.event === 'subscription.completed' ? 'expired' : null;
    if (status && business) await admin.from('business_subscriptions').update({ status, updated_at: new Date().toISOString() }).eq('business_id', business.business_id);
    if (status && household) {
      await admin.from('personal_subscriptions').update({ status, updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
      if (status === 'active') await admin.from('personal_service_entitlements').update({ personal_finance_enabled: true, source: 'subscription', updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
      if (status === 'cancelled' || status === 'expired') await admin.from('personal_service_entitlements').update({ personal_finance_enabled: false, updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
    }
    await admin.from('payment_events').upsert({
      provider: 'razorpay', provider_event_id: `webhook:${subscriptionId}:${event.event}:${event.created_at || 0}`,
      business_id: business?.business_id || null, household_id: household?.household_id || null, event_type: event.event, verified: true, payload: event,
    }, { onConflict: 'provider_event_id', ignoreDuplicates: true });
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('business_razorpay_webhook_failed', { type: error instanceof Error ? error.name : 'unknown' });
    return new Response('Webhook processing failed.', { status: 500 });
  }
});
