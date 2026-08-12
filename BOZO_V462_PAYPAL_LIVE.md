# BOZO v4.6.2 — PayPal Live

This release separates Sandbox and Live PayPal configuration so Live initialization cannot reuse Sandbox product/plan/webhook IDs.

GO-LIVE ORDER
1. Run BOZO_V462_PAYPAL_LIVE_MIGRATION.sql.
2. Replace paypal-bozo-setup with paypal-bozo-setup-v4.6.2-live-index.ts.
3. Replace paypal-bozo-subscription with paypal-bozo-subscription-v4.6.2-live-index.ts.
4. Replace paypal-bozo-webhook with paypal-bozo-webhook-v4.6.2-live-index.ts. Keep JWT verification disabled for this webhook.
5. Set Supabase secrets to the LIVE PayPal app:
   PAYPAL_CLIENT_ID = live client ID
   PAYPAL_CLIENT_SECRET = live secret
   PAYPAL_ENV = live
6. Deploy the v4.6.2 site.
7. As Owner, open BOZO+ and click Initialize PayPal.
8. Verify the panel reports Environment: live AND brand-new Product / Monthly / Annual / Webhook IDs.
9. Only then perform a real purchase.

The frontend displays LIVE · REAL MONEY when connected to the live environment.

Sandbox config is retained under bozo_plus_sandbox; Live config is stored under bozo_plus_live.
