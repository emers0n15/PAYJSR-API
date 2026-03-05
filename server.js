const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PAYJSR_BASE_URL =
  process.env.PAYJSR_BASE_URL || "https://api.payjsr.com/v1";

app.use(cors());
app.use(express.json());

// Serve static files (includes index.html)
app.use(express.static(__dirname));

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (isJson) {
    try {
      return { kind: "json", body: await response.json(), contentType };
    } catch (e) {
      const text = await response.text().catch(() => "");
      return {
        kind: "invalid_json",
        body: {
          parse_error: String(e?.message || e),
          raw_preview: text.slice(0, 800)
        },
        contentType
      };
    }
  }

  const text = await response.text().catch(() => "");
  return { kind: "text", body: { raw_preview: text.slice(0, 800) }, contentType };
}

// Secret key: from env or from x-api-key header (user enters in UI)
const PAYJSR_SECRET_KEY = process.env.PAYJSR_SECRET_KEY || null;

// ─── Helper: call PayJSR API ────────────────────────────────────────────────────
// apiKey: from x-api-key header (user enters in UI) or PAYJSR_SECRET_KEY env. Required.
async function payjsrRequest(method, endpoint, body = null, apiKey = null) {
  const key = (apiKey && String(apiKey).trim()) || PAYJSR_SECRET_KEY;
  if (!key) {
    return { status: 401, data: { error: "missing_api_key", message: "Provide your API key in the UI or set PAYJSR_SECRET_KEY env" } };
  }
  const url = `${PAYJSR_BASE_URL}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key,
      'X-Request-ID': `req_local_${crypto.randomBytes(8).toString('hex')}`,
    },
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  console.log(`→ ${method} ${url}`);
  const res = await fetch(url, options);
  const data = await readApiResponse(res);
  console.log(`← ${res.status}`, JSON.stringify(data.body, null, 2));
  return { status: res.status, data: data.body, requestId: res.headers.get('x-request-id') };
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

// 1. Create a Payment Session
app.post("/api/create-payment", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await payjsrRequest('POST', 'api-create-payment', {
      amount: req.body.amount || 2999,
      currency: req.body.currency || 'USD',
      description: req.body.description || 'Test Product — Integration Demo',
      customer_email: req.body.customer_email || undefined,
      mode: req.body.mode || 'redirect',
      success_url: req.body.success_url || `${req.protocol}://${req.get('host')}/success.html`,
      cancel_url: req.body.cancel_url || `${req.protocol}://${req.get('host')}/`,
    }, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create a Payment Link
app.post("/api/create-link", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await payjsrRequest('POST', 'api-create-link', {
      title: req.body.title || 'Demo Digital Product',
      amount: req.body.amount || 1999,
      currency: req.body.currency || 'USD',
      billing_type: req.body.billing_type || 'one_time',
    }, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get a Payment Link
app.get("/api/get-link/:linkCode", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await payjsrRequest('GET', `api-get-link?link_code=${req.params.linkCode}`, null, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete a Payment Link
app.delete("/api/delete-link/:linkId", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await payjsrRequest('POST', 'api-delete-link', {
      link_id: req.params.linkId,
    }, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. List Transactions
app.get("/api/transactions", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const params = new URLSearchParams();
    if (req.query.status) params.set('status', req.query.status);
    if (req.query.limit) params.set('limit', req.query.limit);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await payjsrRequest('GET', `api-list-transactions${qs}`, null, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Simulate Payment (Test Mode Only)
app.post("/api/simulate-payment", async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await payjsrRequest('POST', 'test-simulate-payment', {
      session_token: req.body.session_token || undefined,
      simulate_failure: req.body.simulate_failure || false,
      customer_email: req.body.customer_email || 'test@example.com',
    }, apiKey);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    console.log(`\n🚀 PayJSR test server running at http://localhost:${port}`);
    console.log(`   Press Ctrl+C to stop.\n`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE" && attempt < 10) {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} in use. Trying ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }
    console.error("Error starting server:", err);
    process.exitCode = 1;
  });
}

startServer(Number(PORT));


