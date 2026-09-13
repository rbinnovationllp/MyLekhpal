import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Input = { businessId?: string; planCode?: string; accessToken?: string };
type Plan = { code: string; razorpay_plan_id: string; interval: 'monthly' | 'yearly' };
type Subscription = { razorpay_subscription_id: string | null; status: string; trial_ends_at: string | null };

const allowedOrigins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
// Subscription access/mandate ends at the close of 31 December 2046 in IST.
const subscriptionEndAt = 2429893799;
const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}) },
});
const timestamp = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 946684800 || value > 4765046400) throw new Error('invalid_razorpay_timestamp');
  return value;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin && allowedOrigins.has(origin)
    ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : {} });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);
  try {
    const input = await req.json() as Input;
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : null);
    if (!authorization?.startsWith('Bearer ') || !input.businessId || !input.planCode) return reply({ error: 'Sign in and choose a business plan.' }, 401, origin);
    const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const keyId = Deno.env.get('RAZORPAY_KEY_ID'), keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!url || !serviceKey || !keyId || !keySecret) return reply({ error: 'Secure subscription setup is not configured. Please contact MyLekhapal support.' }, 503, origin);
    const admin = createClient(url, serviceKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply({ error: 'Sign in to continue.' }, 401, origin);
    const { data: membership } = await admin.from('business_memberships').select('role').eq('business_id', input.businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership || membership.role !== 'owner') return reply({ error: 'Only the business owner can authorise a plan.' }, 403, origin);
    const { data: plan } = await admin.from('subscription_plans').select('code,razorpay_plan_id,interval').eq('code', input.planCode).eq('active', true).maybeSingle<Plan>();
    if (!plan?.razorpay_plan_id) return reply({ error: 'The selected business plan is unavailable.' }, 422, origin);
    const { data: current } = await admin.from('business_subscriptions').select('razorpay_subscription_id,status,trial_ends_at').eq('business_id', input.businessId).maybeSingle<Subscription>();
    if (!current?.trial_ends_at) return reply({ error: 'The business trial is not configured. Please contact support.' }, 409, origin);
    if (current.razorpay_subscription_id && current.status !== 'cancelled' && current.status !== 'expired') return reply({ error: 'A business plan is already awaiting authorisation or active.' }, 409, origin);
    const startAt = timestamp(Math.max(Math.floor(Date.now() / 1000), Math.floor(new Date(current.trial_ends_at).valueOf() / 1000)));
    const expireBy = timestamp(startAt + 24 * 60 * 60);
    // Use an explicit end date rather than a long cycle count. It is within
    // Razorpay's subscription-link maximum duration and avoids QR end_time
    // validation failures caused by an overlong mandate.
    const response = await fetch('https://api.razorpay.com/v1/subscriptions', { method: 'POST', headers: { authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'content-type': 'application/json' }, body: JSON.stringify({ plan_id: plan.razorpay_plan_id, quantity: 1, end_at: subscriptionEndAt, customer_notify: true, start_at: startAt, expire_by: expireBy, notes: { service: 'business_accounting', business_id: input.businessId, plan_code: plan.code } }) });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok || !provider?.id || !provider?.short_url) {
      console.error('business_subscription_provider_rejected', { status: response.status, providerCode: provider?.error?.code, providerReason: provider?.error?.reason, providerDescription: provider?.error?.description, startAt, expireBy });
      return reply({ error: 'Razorpay could not start secure business-plan authorisation. Please retry or contact support.' }, 502, origin);
    }
    const { error: saveError } = await admin.from('business_subscriptions').upsert({ business_id: input.businessId, plan_code: plan.code, razorpay_subscription_id: provider.id, status: 'trial', trial_ends_at: current.trial_ends_at, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    if (saveError) return reply({ error: 'The secure authorisation was created but could not be recorded. Please contact support before completing it.' }, 500, origin);
    await admin.from('payment_events').insert({ provider: 'razorpay', provider_event_id: `subscription-created:${provider.id}`, business_id: input.businessId, event_type: 'subscription.authorisation_requested', verified: false, payload: { plan_code: plan.code, start_at: startAt, end_at: subscriptionEndAt, expire_by: expireBy } });
    return reply({ shortUrl: provider.short_url, subscriptionId: provider.id, trialDurationDays: 14 }, 201, origin);
  } catch (error) {
    console.error('business_subscription_unexpected_error', { type: error instanceof Error ? error.name : 'unknown' });
    return reply({ error: 'Unable to begin secure business-plan authorisation. Please retry shortly.' }, 500, origin);
  }
});
