import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const safeEqual = (a: string, b: string) => a.length === b.length && a.split('').every((char, index) => char === b[index]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed.', { status: 405 });
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const mode = Deno.env.get('RAZORPAY_MODE');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return new Response('Webhook is not configured.', { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  if (!signature || !safeEqual(signature, expected)) return new Response('Invalid signature.', { status: 401 });
  try {
    const event = JSON.parse(raw) as { event?: string; created_at?: number; payload?: { subscription?: { entity?: { id?: string; status?: string } }; payment?: { entity?: { id?: string; status?: string; amount?: number; subscription_id?: string } }; refund?: { entity?: { payment_id?: string } } } };
    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    const admin = createClient(url, serviceKey);
    const refundPaymentId = event.payload?.refund?.entity?.payment_id;
    let subscriptionId = subscription?.id || payment?.subscription_id;
    if (!subscriptionId && refundPaymentId) {
      const { data: prior } = await admin.schema('private').from('razorpay_subscription_payments').select('subscription_id').eq('payment_id', refundPaymentId).maybeSingle();
      subscriptionId = prior?.subscription_id;
    }
    if (!subscriptionId || !event.event) return new Response('Ignored.', { status: 200 });
    const { data: business } = await admin.from('business_subscriptions').select('business_id').eq('razorpay_subscription_id', subscriptionId).maybeSingle();
    const { data: household } = business ? { data: null } : await admin.from('personal_subscriptions').select('household_id').eq('razorpay_subscription_id', subscriptionId).maybeSingle();
    if (!business && !household) return new Response('Ignored.', { status: 200 });
    const status = event.event === 'subscription.activated'
      ? 'active'
      : event.event === 'subscription.cancelled' ? 'cancelled'
      : event.event === 'subscription.completed' ? 'expired'
      : ['subscription.pending', 'subscription.halted'].includes(event.event) ? 'payment_due' : null;
    if (status && business) await admin.from('business_subscriptions').update({ status, updated_at: new Date().toISOString() }).eq('business_id', business.business_id);
    if (status && household) {
      await admin.from('personal_subscriptions').update({ status, updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
      if (status === 'active') await admin.from('personal_service_entitlements').update({ personal_finance_enabled: true, source: 'subscription', updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
      if (status === 'cancelled' || status === 'expired') await admin.from('personal_service_entitlements').update({ personal_finance_enabled: false, updated_at: new Date().toISOString() }).eq('household_id', household.household_id);
    }
    // Only a captured, positive, LIVE subscription charge proves paid adoption.
    // Authentication/token payments and test-mode traffic are deliberately excluded.
    if (event.event === 'subscription.charged' && mode === 'live' && payment?.id && payment.status === 'captured' && Number(payment.amount || 0) > 0) {
      await admin.schema('private').from('razorpay_subscription_payments').upsert({
        payment_id: payment.id, subscription_id: subscriptionId,
        business_id: business?.business_id || null, household_id: household?.household_id || null,
        amount_paise: Number(payment.amount), payment_status: 'captured', live_mode: true,
        paid_at: new Date((event.created_at || Math.floor(Date.now() / 1000)) * 1000).toISOString(), refunded_at: null,
      });
    }
    if (event.event.startsWith('refund.') && event.payload?.refund?.entity?.payment_id) {
      await admin.schema('private').from('razorpay_subscription_payments').update({ payment_status: 'refunded', refunded_at: new Date().toISOString() }).eq('payment_id', event.payload.refund.entity.payment_id);
    }
    await admin.from('payment_events').upsert({
      provider: 'razorpay', provider_event_id: `webhook:${await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)).then((v) => hex(v))}`,
      business_id: business?.business_id || null, household_id: household?.household_id || null, event_type: event.event, verified: true, payload: event,
    }, { onConflict: 'provider_event_id', ignoreDuplicates: true });
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('business_razorpay_webhook_failed', { type: error instanceof Error ? error.name : 'unknown' });
    return new Response('Webhook processing failed.', { status: 500 });
  }
});
