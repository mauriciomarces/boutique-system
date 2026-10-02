const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const { validateEvent } = require("./validate");
const { addEvent, listEvents } = require("./store");
const { correlate } = require("./correlation");
const { FEATURE_COLUMNS } = require("./constants");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT || 4007);
const aiServiceUrl = process.env.AI_SERVICE_URL || "http://ai-service:4008";

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "logic-correlation-service",
    port,
  });
});

app.post("/events", (req, res) => {
  const result = validateEvent(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  addEvent(result.event);
  return res.status(201).json(result.event);
});

app.get("/events", (req, res) => {
  const items = listEvents({
    usuario_id: req.query.usuario_id,
    limit: req.query.limit,
  });
  res.json({ count: items.length, events: items });
});

function resolveEvents(body) {
  if (Array.isArray(body?.events) && body.events.length) {
    const validated = [];
    for (const item of body.events) {
      const result = validateEvent(item);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      validated.push(result.event);
    }
    return { ok: true, events: validated, usuario_id: body.usuario_id };
  }

  const stored = listEvents({ usuario_id: body?.usuario_id });
  return { ok: true, events: stored, usuario_id: body?.usuario_id };
}

app.post("/correlations/analyze", (req, res) => {
  const resolved = resolveEvents(req.body || {});
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  const analysis = correlate(resolved.events, {
    usuario_id: resolved.usuario_id,
    reference_timestamp: req.body?.reference_timestamp,
  });
  return res.json(analysis);
});

app.post("/features/generate", (req, res) => {
  const resolved = resolveEvents(req.body || {});
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  const analysis = correlate(resolved.events, {
    usuario_id: resolved.usuario_id,
    reference_timestamp: req.body?.reference_timestamp,
  });
  return res.json({
    columns: FEATURE_COLUMNS,
    features: analysis.features,
    rules: analysis.rules,
  });
});

app.post("/analyze-and-classify", async (req, res) => {
  const resolved = resolveEvents(req.body || {});
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }

  const analysis = correlate(resolved.events, {
    usuario_id: resolved.usuario_id,
    reference_timestamp: req.body?.reference_timestamp,
  });

  try {
    const response = await fetch(`${aiServiceUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysis.features),
    });
    const classification = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        correlation: analysis,
        classification_error: classification,
      });
    }
    return res.json({
      correlation: analysis,
      classification,
    });
  } catch (error) {
    return res.status(503).json({
      error: "ai-service no disponible",
      correlation: analysis,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`logic-correlation-service listening on ${port}`);
  });
}

module.exports = app;
