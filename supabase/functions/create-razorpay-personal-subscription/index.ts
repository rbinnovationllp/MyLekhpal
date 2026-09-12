import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Input = { householdId?: string; planCode?: string; accessToken?: string };
type Plan = { code: string; razorpay_plan_id: string; interval: 'monthly' | 'yearly' };

const allowedOrigins = new Set(['https://mylekhpal.com', 'https://www.mylekhpal.com', 'http://localhost:5173']);
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (body: unknown, status = 200, origin?: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}) },
});

const nowSeconds = () => Math.floor(Date.now() / 1000);
// Razorpay expects Unix timestamps in seconds (not JavaScript milliseconds) and
// requires the authorisation window to extend beyond a future subscription start.
const razorpayTimestamp = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 946684800 || value > 4765046400) {
    throw new Error('invalid_razorpay_timestamp');
  }
  return value;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: origin && allowedOrigins.has(origin)
      ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' }
      : {},
  });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Request origin rejected.' }, 403, origin);

  try {
    const input = await req.json() as Input;
    const authorization = req.headers.get('authorization') || (input.accessToken ? `Bearer ${input.accessToken}` : null);
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Sign in to continue.' }, 401, origin);
    if (!input.householdId || !input.planCode) return reply({ error: 'Choose a personal workspace and plan.' }, 400, origin);

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!url || !serviceKey || !razorpayKeyId || !razorpayKeySecret) {
      console.error('personal_subscription_configuration_missing', {
        hasSupabaseUrl: Boolean(url), hasServiceKey: Boolean(serviceKey), hasRazorpayKeyId: Boolean(razorpayKeyId), hasRazorpayKeySecret: Boolean(razorpayKeySecret),
      });
      return reply({ error: 'Secure subscription setup is not configured. Please contact MyLekhapal support.' }, 503, origin);
    }

    const admin = createClient(url, serviceKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice('Bearer '.length));
    if (authError || !user) return reply({ error: 'Sign in to continue.' }, 401, origin);

    const { data: member } = await admin.from('household_memberships')
      .select('role').eq('household_id', input.householdId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!member || member.role !== 'owner') return reply({ error: 'Only the personal-workspace owner can authorise a plan.' }, 403, origin);

    const { data: plan, error: planError } = await admin.from('personal_subscription_plans')
      .select('code,razorpay_plan_id,interval').eq('code', input.planCode).eq('active', true).maybeSingle<Plan>();
    if (planError || !plan) return reply({ error: 'The selected plan is unavailable. Please choose another plan.' }, 422, origin);

    const { data: current } = await admin.from('personal_subscriptions')
      .select('razorpay_subscription_id,status,plan_code').eq('household_id', input.householdId).maybeSingle();
    if (current?.status === 'trial' || current?.status === 'active') {
      return reply({ error: 'This personal workspace already has an authorised plan.' }, 409, origin);
    }
    if (current?.razorpay_subscription_id && current.status === 'pending_authorisation') {
      return reply({ error: 'An AutoPay authorisation is already awaiting completion. Use the secure Razorpay link already sent to you, or contact support if it has expired.' }, 409, origin);
    }

    // The trial begins only after Razorpay sends a verified subscription.authenticated webhook.
    // `start_at` prevents the first recurring charge during the three-day personal-service trial.
    const createdAt = nowSeconds();
    const startAt = razorpayTimestamp(createdAt + (3 * 24 * 60 * 60));
    // `expire_by` is Razorpay's authorisation-window end. It must not close
    // before `start_at`; doing so prevents Razorpay from creating/refreshing
    // the UPI mandate QR code. Keep it open for one day after the trial start.
    const expireBy = razorpayTimestamp(startAt + (24 * 60 * 60));
    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: plan.razorpay_plan_id,
        quantity: 1,
        total_count: plan.interval === 'yearly' ? 100 : 1200,
        customer_notify: true,
        start_at: startAt,
        expire_by: expireBy,
        notes: { service: 'personal_finance', household_id: input.householdId, plan_code: plan.code },
      }),
    });
    const providerBody = await response.json().catch(() => ({}));
    if (!response.ok || !providerBody?.id || !providerBody?.short_url) {
      console.error('personal_subscription_provider_rejected', {
        status: response.status,
        providerCode: providerBody?.error?.code,
        providerReason: providerBody?.error?.reason,
        providerDescription: providerBody?.error?.description,
        startAt,
        expireBy,
      });
      return reply({ error: 'Razorpay could not start secure AutoPay authorisation. Please retry or contact support.' }, 502, origin);
    }

    const { error: saveError } = await admin.from('personal_subscriptions').upsert({
      household_id: input.householdId,
      plan_code: plan.code,
      razorpay_subscription_id: providerBody.id,
      // The scheduled first charge and the service trial begin together. A
      // verified webhook enables the entitlement; it changes this to active.
      status: 'trial',
      trial_ends_at: new Date(startAt * 1000).toISOString(),
      current_period_ends_at: null,
      payment_due_at: null,
      restricted_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'household_id' });
    if (saveError) {
      console.error('personal_subscription_save_failed', { code: saveError.code });
      return reply({ error: 'The secure authorisation was created but could not be recorded. Please contact support before completing payment authorisation.' }, 500, origin);
    }
    await admin.from('personal_subscription_events').insert({
      household_id: input.householdId,
      actor_user_id: user.id,
      actor_type: 'human',
      action: 'autopay_authorisation_requested',
      provider_event_id: `subscription-created:${providerBody.id}`,
      details: { plan_code: plan.code, provider_subscription_id: providerBody.id, trial_ends_at: new Date(startAt * 1000).toISOString(), start_at: startAt, expires_at: expireBy },
    });

    return reply({ shortUrl: providerBody.short_url, subscriptionId: providerBody.id, trialDurationDays: 3 }, 201, origin);
  } catch (error) {
    console.error('personal_subscription_unexpected_error', { type: error instanceof Error ? error.name : 'unknown' });
    return reply({ error: 'Unable to begin secure AutoPay authorisation. Please retry shortly.' }, 500, origin);
  }
});
