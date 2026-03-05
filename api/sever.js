/**
 * PayJSR Integration Test Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Configuration ─────────────────────────────────────────────
const PAYJSR_API_BASE = 'https://api.payjsr.com/v1';
const PAYJSR_SECRET_KEY = process.env.PAYJSR_SECRET_KEY || null;

// ─── Helper: call PayJSR API ───────────────────────────────────
async function payjsrRequest(method, endpoint, body = null) {
  if (!PAYJSR_SECRET_KEY) {
    return { status: 401, data: { error: "missing_api_key", message: "Set PAYJSR_SECRET_KEY env or use the main server.js (user enters key in UI)" } };
  }

  const url = `${PAYJSR_API_BASE}/${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PAYJSR_SECRET_KEY,
      'X-Request-ID': `req_local_${crypto.randomBytes(8).toString('hex')}`,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log(`→ ${method} ${url}`);

  const res = await fetch(url, options);
  const data = await res.json();

  console.log(`← ${res.status}`, JSON.stringify(data, null, 2));

  return {
    status: res.status,
    data,
    requestId: res.headers.get('x-request-id'),
  };
}

// ─── Routes ─────────────────────────────────────────────────────

// 1. Create Payment Session (POST /v1/payments)
app.post('/api/create-payment', async (req, res) => {
  try {

    const result = await payjsrRequest('POST', 'payments', {
      amount: req.body.amount || 2999,
      currency: req.body.currency || 'USD',
      description: req.body.description || 'Test Product — Integration Demo',
      billing_type: req.body.billing_type || 'one_time',
      customer_email: req.body.customer_email || undefined,
      mode: req.body.mode || 'redirect',
      success_url: req.body.success_url || 'http://localhost:3333/success.html',
      cancel_url: req.body.cancel_url || 'http://localhost:3333/',
      metadata: {
        source: 'integration-test',
        timestamp: Date.now(),
      },
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create Payment Link (POST /v1/links)
app.post('/api/create-link', async (req, res) => {
  try {

    const result = await payjsrRequest('POST', 'links', {
      title: req.body.title || 'Demo Digital Product',
      description: req.body.description || 'A test payment link created via API',
      amount: req.body.amount || 1999,
      currency: req.body.currency || 'USD',
      billing_type: req.body.billing_type || 'one_time',
      metadata: {
        source: 'integration-test',
      },
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Payment Link (GET /v1/links?link_code=...)
app.get('/api/get-link/:linkCode', async (req, res) => {

  try {

    const result = await payjsrRequest(
      'GET',
      `links?link_code=${req.params.linkCode}`
    );

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// 4. Delete Payment Link (DELETE /v1/links?link_id=...)
app.delete('/api/delete-link/:linkId', async (req, res) => {

  try {

    const result = await payjsrRequest(
      'DELETE',
      `links?link_id=${encodeURIComponent(req.params.linkId)}`
    );

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// 5. List Transactions (GET /v1/transactions)
app.get('/api/transactions', async (req, res) => {

  try {

    const params = new URLSearchParams();

    if (req.query.status) params.set('status', req.query.status);
    if (req.query.limit) params.set('limit', req.query.limit);

    const qs = params.toString() ? `?${params.toString()}` : '';

    const result = await payjsrRequest('GET', `transactions${qs}`);

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// 6. Simulate Payment (POST /v1/simulate)
app.post('/api/simulate-payment', async (req, res) => {

  try {

    const result = await payjsrRequest('POST', 'simulate', {
      session_token: req.body.session_token || undefined,
      simulate_failure: req.body.simulate_failure || false,
      customer_email: req.body.customer_email || 'test@example.com',
      amount: req.body.amount || 2999,
      currency: req.body.currency || 'USD',
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// 7. Webhook Receiver
app.post('/webhook/payjsr', (req, res) => {

  const signature = req.headers['x-payjsr-signature'];

  console.log('═══ WEBHOOK RECEIVED ═══');
  console.log('Signature:', signature);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('════════════════════════');

  res.json({ received: true });

});

// ─── Start Server ───────────────────────────────────────────────

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {

  console.log(`\n🚀 PayJSR Integration Test Server running at http://localhost:${PORT}`);
  console.log(`   API Key: ${PAYJSR_SECRET_KEY.slice(0, 12)}...`);
  console.log(`   Webhook endpoint: http://localhost:${PORT}/webhook/payjsr\n`);

});