# BOZO v4.6.1 — PayPal Sandbox Checkout

This stage adds real PayPal Sandbox subscription checkout and automatic BOZO+ entitlement.

Deploy in this exact order:

1. Run `BOZO_V461_PAYPAL_SUBSCRIPTIONS.sql`.
2. Replace the existing `paypal-bozo-setup` Edge Function with `paypal-bozo-setup-v4.6.1-index.ts` and deploy.
3. Create an authenticated Edge Function named exactly `paypal-bozo-subscription`, paste `paypal-bozo-subscription-index.ts`, and deploy normally.
4. Create an Edge Function named exactly `paypal-bozo-webhook`, paste `paypal-bozo-webhook-index.ts`, and deploy with JWT verification DISABLED. PayPal cannot send a BOZO user JWT; authenticity is established by PayPal webhook signature verification instead.
5. Deploy the v4.6.1 site ZIP.
6. As Owner, open BOZO+ and click `Finish PayPal Sandbox setup`. It should show the existing Product and Plan IDs plus a new Webhook ID.
7. Use a non-PayPal-subscribed BOZO account (an alt is ideal), open BOZO+, and use the Monthly or Annual PayPal Sandbox button.
8. Pay with a PayPal Sandbox PERSONAL buyer account, not your sandbox business seller account.
9. After approval, BOZO server-verifies the subscription with PayPal before granting BOZO+.
10. The signed webhook maintains entitlement for later ACTIVATE / CANCEL / SUSPEND / EXPIRE events.

Security:
- PAYPAL_CLIENT_SECRET remains only in Edge Function secrets.
- The browser receives only the public PayPal Client ID and PayPal Plan IDs.
- Browser approval alone does not grant BOZO+.
- Webhook messages are verified against PayPal's `verify-webhook-signature` API before changing entitlements.
- Owner manual BOZO+ grants are tagged `manual` so a PayPal cancellation does not revoke an unrelated manual grant.

Sandbox only. Do not switch `PAYPAL_ENV` to live yet.
