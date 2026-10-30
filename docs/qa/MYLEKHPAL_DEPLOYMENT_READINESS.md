# Deployment readiness

**Recommendation: NO-GO for direct production deployment until staging checks pass.**

Deploy the generated `dist/` contents and `public/.htaccess` to a staging Hostinger site first. Use synthetic users only to test direct routes, signup/recovery, onboarding, business isolation, OAuth disconnect/reconnect, subscription handoff, and 390/768/1440px layouts. Confirm Supabase Edge Function secrets and redirect URLs through the console without exposing them in source.
