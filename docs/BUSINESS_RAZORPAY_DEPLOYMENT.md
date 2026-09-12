# Business Accounting trial and Razorpay deployment

1. Run `supabase/migrations/202609120002_business_trial_and_razorpay_authorisation.sql` once in the Supabase SQL Editor.
2. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` as Supabase Edge Function secrets. Never expose them in Hostinger or browser variables.
3. Deploy the functions:

```powershell
npx supabase functions deploy create-razorpay-business-subscription --project-ref xmotjwexpieudlbqpyno --no-verify-jwt
npx supabase functions deploy razorpay-business-webhook --project-ref xmotjwexpieudlbqpyno --no-verify-jwt
```

4. In Razorpay Dashboard, register the webhook URL:

```text
https://xmotjwexpieudlbqpyno.functions.supabase.co/razorpay-business-webhook
```

Enable `subscription.authenticated`, `subscription.activated`, and `subscription.cancelled`. Use the same webhook secret configured in Supabase. This verified webhook handles both Business Accounting and Personal Finance subscriptions.

5. Build and upload the Hostinger frontend. Verify with a Razorpay test account before enabling live checkout.

The business trial begins when a business is created and lasts 14 days. The authorization QR remains valid through one day after the planned trial end, so it cannot close before the recurring subscription begins.
