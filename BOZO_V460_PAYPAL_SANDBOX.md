# BOZO v4.6.0 PayPal Sandbox
1. Run BOZO_V460_PAYPAL_CONFIG.sql.
2. Create Edge Function `paypal-bozo-setup`.
3. Paste paypal-bozo-setup-index.ts into it and deploy.
4. Confirm PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV=sandbox are saved.
5. Deploy v4.6.0.
6. As Owner, open BOZO+ and click Initialize PayPal Sandbox once.
No real checkout or automatic entitlement is enabled yet.
