<div align="center">
  <img src="assets/logo.png" alt="PayJSR" width="120" />
</div>

# PayJSR API Integration Tester

A simple, local test environment for the [PayJSR](https://payjsr.com) payment API. Test checkout flows, payment links, transactions, and the JavaScript SDK without exposing your secret key in client code.

---

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000), enter your PayJSR Secret Key (`sk_test_` or `sk_live_`), and use the UI to test all endpoints.

---

## Prerequisites

1. Create an account at [payjsr.com](https://payjsr.com) and complete onboarding.
2. Go to **Seller Dashboard → Developer → API Keys**.
3. Create a **Secret Key** (use `sk_test_` for testing; no real charges).

---

## API Usage

This project runs a local proxy that forwards requests to the PayJSR API. Your secret key is sent from the browser to the proxy only; it never goes to PayJSR directly from client-side code.

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/create-payment` | Create a checkout session |
| POST | `/api/create-link` | Create a payment link |
| GET | `/api/get-link/:linkCode` | Get a payment link by code |
| DELETE | `/api/delete-link/:linkId` | Delete a payment link |
| GET | `/api/transactions` | List transactions (query: `status`, `limit`) |
| POST | `/api/simulate-payment` | Simulate success/failure (test mode only) |

### Authentication

Include your secret key in the `x-api-key` header:

```bash
curl -X POST http://localhost:3000/api/create-payment \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_test_your_key" \
  -d '{"amount": 2999, "currency": "USD", "description": "Test"}'
```

### Create Payment

```json
POST /api/create-payment
{
  "amount": 2999,
  "currency": "USD",
  "description": "Pro Plan",
  "mode": "redirect",
  "customer_email": "buyer@example.com",
  "success_url": "https://yoursite.com/success",
  "cancel_url": "https://yoursite.com/cancel"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Amount in cents (2999 = $29.99). Min: 50 |
| currency | string | No | ISO 4217 (USD, EUR, GBP, BRL…). Default: USD |
| description | string | No | Shown on checkout |
| mode | string | No | `redirect` (default) or `enabled` |
| customer_email | string | For `enabled` mode | Pre-filled, locked email |
| success_url | string | No | Redirect after payment |
| cancel_url | string | No | Redirect on cancel |

### Create Link

```json
POST /api/create-link
{
  "title": "Digital Product",
  "amount": 1999,
  "currency": "USD",
  "billing_type": "one_time"
}
```

`billing_type`: `one_time` | `monthly` | `yearly`

### Simulate Payment (Test Mode)

```json
POST /api/simulate-payment
{
  "session_token": "sess_xxx",
  "customer_email": "test@example.com",
  "simulate_failure": false
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `PAYJSR_SECRET_KEY` | Optional fallback key; UI input takes precedence |
| `PAYJSR_BASE_URL` | PayJSR API base (default: `https://api.payjsr.com/v1`) |

---

## JavaScript SDK

The UI includes the PayJSR SDK for testing:

- **`PayJSR.openCheckout(sessionId, options)`** — Open checkout (redirect or popup).
- **`PayJSR.createButton(containerId, sessionId, options)`** — Render a Pay button.

```html
<script src="https://js.payjsr.com/v1/payjsr.js"></script>
<script>
  PayJSR.openCheckout("sess_xxx", { mode: "popup" });
</script>
```

---

## Deployment

Works on [Railway](https://railway.app), [Render](https://render.com), or any Node.js host. Set `PAYJSR_SECRET_KEY` (or use the in-app key field) and ensure `success_url` / `cancel_url` use your production domain.

---

## License

MIT
