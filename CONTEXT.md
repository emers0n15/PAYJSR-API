Base URL
https://api.payjsr.com/v1

Authentication
All API requests require a secret API key. Publishable keys (pk_) cannot be used for server-side API calls.

Include your secret key in the x-api-key header or as a Bearer token:

curl -X POST "https://api.payjsr.com/v1/api-create-payment" \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_your_secret_key" \
  -d '{"amount": 2999, "currency": "USD"}'
Never expose secret keys in client-side code. Use sk_live_ or sk_test_ keys only on your server. Use the JS SDK for client-side integrations.

sk_live_
Live (processes real charges)
sk_test_
Test (no real charges)
pk_live_
Publishable (JS SDK only)
Checkout Modes
The mode parameter controls how the checkout experience is presented to your customer.

Redirect Mode
mode: "redirect"
Default
Redirects your customer to a full PayJSR checkout page with product context, seller branding, and all payment methods. Best for web applications.

Full product checkout page with seller branding
Email field editable if customer_email not provided
Supports one-time, monthly, and yearly billing
Enabled Mode
mode: "enabled"
A streamlined, infrastructure-level payment page with no product context. The buyer's email is pre-filled and locked. Ideal for mobile apps and embedded checkouts.

Requires customer_email
Minimal UI — amount + card form only
Perfect for: mobile apps, SaaS billing, embedded checkout
API Endpoints
POST
/api-create-payment
Create a checkout session. Returns a checkout_url to redirect your customer.

Request Body
Response
{
  "amount": 2999,              // Required. Amount in cents (2999 = $29.99)
  "currency": "USD",           // Optional. Any Stripe-supported ISO 4217 code. Default: "USD"
  "description": "Pro Plan",   // Optional. Shown on checkout
  "billing_type": "one_time",  // Optional. "one_time" | "monthly" | "yearly"
  "customer_email": "a@b.com", // Required for mode: "enabled"
  "mode": "redirect",          // Optional. "redirect" (default) | "enabled"
  "success_url": "https://...",// Optional. Redirect after payment
  "cancel_url": "https://...", // Optional. Redirect on cancel
  "webhook_url": "https://...",// Optional. Per-session webhook override
  "metadata": { "key": "val" } // Optional. Custom metadata (returned in webhooks)
}
Amount format: Integer in the smallest currency unit (cents). For example, $29.99 = 2999. Minimum: 50 (= $0.50).

GET
/api-list-transactions
List all your API transactions with filters

Query params:
status
from_date
to_date
page
POST
/test-simulate-payment
Test only
Simulate a payment completion or failure without real charges. Requires sk_test_ key.

Body:
session_token
simulate_failure
customer_email
Settlement & Currency
PayJSR accepts payments in any currency supported by Stripe and settles all payouts in USD.

How Currency Works
The currency parameter accepts any ISO 4217 code supported by Stripe (USD, EUR, GBP, BRL, ZAR, etc.)
Buyers are charged in the specified currency — no conversion on the buyer side
Settlement is always in USD. Stripe handles automatic currency conversion at prevailing exchange rates
Ledger entries, payout balances, and platform fees are recorded in USD
Webhook payloads include the original currency the buyer was charged in
No country routing: PayJSR does not perform manual currency routing. All payment processing, conversion, and settlement is handled by Stripe's global infrastructure.

Test Mode
Use test keys (sk_test_) to create test checkout sessions. No real charges are made.

How Test Mode Works
Sessions created with sk_test_ keys are marked as test
Checkout pages show a "TEST MODE" banner
Test payments never create ledger entries or affect payouts
Use /test-simulate-payment to simulate completions/failures without Stripe sandbox
Test webhooks dispatch with environment: "test" filter
Environment Separation
Live keys (sk_live_) create real Stripe charges and ledger entries
Test keys (sk_test_) create test-flagged sessions with no real charges
Webhooks configured as "test" only receive test events; "live" webhooks only receive live events
API transactions are tagged with is_test and separated in your dashboard
// 1. Create a test checkout session
const res = await fetch("https://api.payjsr.com/v1/api-create-payment", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "sk_test_your_test_key"  // Test key
  },
  body: JSON.stringify({
    amount: 2999,
    currency: "USD",
    description: "Test Payment"
  })
});
const { data } = await res.json();
// data.environment === "test"
// data.checkout_url includes ?test=true

// 2. Simulate payment completion (no Stripe sandbox needed)
await fetch("https://api.payjsr.com/v1/test-simulate-payment", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "sk_test_your_test_key"
  },
  body: JSON.stringify({
    session_token: data.payment_id,
    simulate_failure: false  // true to test failure path
  })
});
Webhooks
Receive real-time notifications when payments complete. Configure webhooks in your seller dashboard under Developer → Webhooks.

Live Events
Dispatched when real payments are processed via Stripe.

payment.completed
Order completed — ledger entry created, payout balance updated
Test Events
Dispatched only by /test-simulate-payment with sk_test_ keys.

payment.succeeded
Test only
Test payment simulated successfully
payment.failed
Test only
Test payment simulated as failed
Subscription webhooks: Subscription lifecycle events (creation, renewal, cancellation) are managed internally. Developer webhook dispatch for subscription events is not currently available.

Live Payload Format
// POST to your webhook URL
// Headers:
//   Content-Type: application/json
//   X-PayJSR-Signature: <HMAC-SHA256 hex signature>
//   X-PayJSR-Event: payment.completed
//   X-PayJSR-Timestamp: 2026-03-02T12:00:00.000Z

{
  "event": "payment.completed",
  "data": {
    "payment_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",  // Order UUID
    "order_number": "PJSR-0326-123456",
    "amount": 2999,
    "currency": "USD",
    "customer_email": "buyer@example.com",
    "product_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // or null
    "metadata": { "key": "val" }
  },
  "created_at": "2026-03-02T12:00:00.000Z"
}
Test Payload Format
// Dispatched by /test-simulate-payment
{
  "event": "payment.succeeded",
  "data": {
    "payment_id": "sess_a1b2c3d4...",    // Session token
    "amount": 2999,
    "currency": "USD",
    "customer_email": "test@payjsr.com",
    "test": true
  },
  "created_at": "2026-03-02T12:00:00.000Z"
}
Verifying Webhook Signatures (HMAC-SHA256)
Each webhook is signed with your webhook secret using HMAC-SHA256. The signature is in the X-PayJSR-Signature header. Verify it by computing the HMAC of the raw request body.

Node.js
Python
const crypto = require('crypto');

function verifyWebhook(rawBody, signature, webhookSecret) {
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

// Express example
app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const sig = req.headers['x-payjsr-signature'];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  const event = JSON.parse(req.body);
  // Handle event...
  res.status(200).send('OK');
});
Retry policy: Failed deliveries are retried up to 3 times with exponential backoff (1s, 2s, 4s). All delivery attempts are logged and visible in your developer dashboard.

JavaScript SDK
Embed PayJSR checkout into any website with a single script tag. The SDK handles opening the checkout page.

<!-- Include the SDK -->
<script src="https://js.payjsr.com/v1/payjsr.js"></script>

<div id="pay-button"></div>

<script>
  // Option 1: Open checkout via redirect (default)
  PayJSR.openCheckout("sess_a1b2c3d4...");

  // Option 2: Open checkout in a popup window
  PayJSR.openCheckout("sess_a1b2c3d4...", {
    mode: "popup",
    width: 480,
    height: 700
  });

  // Option 3: Create a styled "Pay with PayJSR" button
  // Signature: PayJSR.createButton(containerId, sessionId, options)
  PayJSR.createButton("pay-button", "sess_a1b2c3d4...", {
    text: "Pay Now"     // Button label (default: "Pay with PayJSR")
  });
</script>
Integration flow: Your server calls POST /api-create-payment with a secret key → receives payment_id (session token) → passes it to the frontend → JS SDK opens the checkout.

SDK Methods Reference
PayJSR.openCheckout(sessionId, options?)
Opens the checkout page. Pass { mode: "popup" } for a popup window instead of redirect.

PayJSR.createButton(containerId, sessionId, options?)
Creates a styled button inside the element with the given ID (plain string, no #). Options: text (button label).

Rate Limits & Idempotency
Rate Limiting
Each API key has configurable rate limits. When exceeded, requests return 429 Rate Limited.

Per-minute limit
Default: 60 requests/min
Per-hour limit
Default: 1000 requests/hr
Rate limits are validated server-side per API key. Contact support for higher limits.

Idempotency
Each checkout session has a unique payment_id (session token) preventing duplicate charges
Ledger entries are deduplicated using Stripe's balance_transaction_id — replaying the same payment intent will not create duplicate records
Sessions expire after 30 minutes — expired sessions cannot be completed
Full Integration Examples
JavaScript
Python
cURL
// Server-side: Create a checkout session
const createCheckout = async (order) => {
  const response = await fetch(
    'https://api.payjsr.com/v1/api-create-payment',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PAYJSR_SECRET_KEY  // sk_live_ or sk_test_
      },
      body: JSON.stringify({
        amount: order.totalCents,    // e.g., 2999 for $29.99
        currency: 'USD',
        description: order.productName,
        customer_email: order.email,
        mode: 'redirect',
        success_url: 'https://yoursite.com/success',
        cancel_url: 'https://yoursite.com/cancel',
        webhook_url: 'https://yoursite.com/webhooks/payjsr',
        metadata: { order_id: order.id }
      })
    }
  );
  
  const { data } = await response.json();
  return data.checkout_url;  // Redirect customer here
};

// Subscription example
const createSubscription = async (plan) => {
  const response = await fetch(
    'https://api.payjsr.com/v1/api-create-payment',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PAYJSR_SECRET_KEY
      },
      body: JSON.stringify({
        amount: 999,                 // $9.99/month
        currency: 'USD',
        billing_type: 'monthly',     // or 'yearly'
        description: plan.name,
        customer_email: plan.email,
        mode: 'enabled'
      })
    }
  );
  const { data } = await response.json();
  return data.checkout_url;
};
Error Codes
400
Bad Request
Invalid parameters (amount < 50, invalid billing_type, etc.)
invalid_amount, invalid_billing_type, invalid_mode, missing_email
401
Unauthorized
Missing or invalid API key
missing_api_key, invalid_api_key
403
Forbidden
Publishable key used for server-side operation
publishable_key_not_allowed
429
Rate Limited
Too many requests — reduce frequency
rate_limited
500
Server Error
Internal server error
internal_error
