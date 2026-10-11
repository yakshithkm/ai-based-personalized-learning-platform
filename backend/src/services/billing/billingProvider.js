/**
 * Payment-provider seam. TutorMind has NO payment integration yet, and this file intentionally
 * does not pretend otherwise: every method fails with PAYMENT_NOT_CONFIGURED.
 *
 * To add Stripe / Razorpay later:
 *   1. Implement { createCheckoutSession, handleWebhook } in a new module (e.g. stripeProvider.js)
 *      and return it from getBillingProvider() when its env vars are present.
 *   2. createCheckoutSession(user, tier) -> { url } for the hosted checkout page.
 *   3. handleWebhook(rawBody, headers) verifies the provider signature and, on a paid / renewed /
 *      cancelled event, calls subscriptionService.applySubscription(userId, { tier, status,
 *      startDate, endDate, provider, externalId }). Nothing else in the access-control layer
 *      changes - middleware already reads tier/status/endDate from the database on every request.
 *   4. Mount the webhook route BEFORE express.json() in app.js (providers need the raw body).
 */
class PaymentNotConfiguredError extends Error {
  constructor() {
    super('Online payments are not enabled yet. No subscription was purchased or changed.');
    this.statusCode = 501;
    this.code = 'PAYMENT_NOT_CONFIGURED';
  }
}

const noopProvider = {
  name: 'none',
  configured: false,
  async createCheckoutSession() {
    throw new PaymentNotConfiguredError();
  },
  async handleWebhook() {
    throw new PaymentNotConfiguredError();
  },
};

const getBillingProvider = () => noopProvider;

module.exports = { getBillingProvider, PaymentNotConfiguredError };
