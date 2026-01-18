const paypal = require('@paypal/checkout-server-sdk');

// PayPal Environment Configuration
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || "YOUR_PAYPAL_CLIENT_ID";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "YOUR_PAYPAL_CLIENT_SECRET";

  // Use production environment for live payments
  return process.env.NODE_ENV === 'production'
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

// PayPal Merchant Account Configuration
const MERCHANT_CONFIG = {
  email: 'denisbamboo@yahoo.com',
  paypalId: process.env.PAYPAL_MERCHANT_ID || 'YOUR_MERCHANT_ID',
  // Commission rates
  affiliateCommission: 0.15, // 15% commission for affiliates
  platformFee: 0.05 // 5% platform fee
};

module.exports = {
  client,
  environment,
  MERCHANT_CONFIG
};


