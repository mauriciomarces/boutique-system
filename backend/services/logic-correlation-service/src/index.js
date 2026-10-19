const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { randomUUID } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");

const { validateEvent } = require("./validate");
const { addEvent, addAnalysis, listEvents, listAnalyses } = require("./store");
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
  try {
    const stored = addEvent(result.event);
    if (stored.status === "conflict") {
      return res.status(409).json({ error: "event_id ya existe con otro contenido." });
    }
    return res.status(stored.status === "duplicate" ? 200 : 201).json({
      ...stored.event,
      ingest_status: stored.status,
    });
  } catch (error) {
    console.error("No se pudo persistir el evento recibido.", {
      event_id: result.event.event_id,
      error: error instanceof Error ? error.message : "error de almacenamiento",
    });
    return res.status(503).json({ error: "No se pudo persistir el evento." });
  }
});

app.get("/events", (req, res) => {
  for (const key of ["from", "to"]) {
    if (req.query[key] && Number.isNaN(Date.parse(String(req.query[key])))) {
      return res.status(400).json({ error: `${key} debe ser una fecha ISO válida.` });
    }
  }
  const limit = req.query.limit === undefined ? "500" : req.query.limit;
  if (!/^\d+$/.test(String(limit)) || Number(limit) > 1000) {
    return res.status(400).json({ error: "limit debe ser un entero entre 0 y 1000." });
  }
  const items = listEvents({
    usuario_id: req.query.usuario_id,
    service: req.query.service,
    tipo_evento: req.query.tipo_evento,
    from: req.query.from,
    to: req.query.to,
    limit,
  });
  res.json({ count: items.length, events: items });
});

app.get("/analyses", (req, res) => {
  const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return res.status(400).json({ error: "limit debe ser un entero entre 1 y 500." });
  }
  return res.json({ analyses: listAnalyses({ limit }) });
});

function resolveEvents(body) {
  for (const field of ["from", "to", "reference_timestamp"]) {
    if (
      body?.[field] !== undefined &&
      (typeof body[field] !== "string" || Number.isNaN(Date.parse(body[field])))
    ) {
      return { ok: false, error: `${field} debe ser una fecha ISO válida.` };
    }
  }
  if (body?.from && body?.to && Date.parse(body.from) > Date.parse(body.to)) {
    return { ok: false, error: "from no puede ser posterior a to." };
  }
  const userFilter = Object.hasOwn(body || {}, "usuario_id")
    ? (body.usuario_id === null ? "anonymous" : body.usuario_id)
    : undefined;
  if (Array.isArray(body?.events) && body.events.length) {
    const validatedById = new Map();
    for (const item of body.events) {
      const result = validateEvent(item);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      const previous = validatedById.get(result.event.event_id);
      if (previous && !isDeepStrictEqual(previous, result.event)) {
        return { ok: false, error: "event_id repetido con contenido diferente." };
      }
      validatedById.set(result.event.event_id, result.event);
    }
    const validated = [...validatedById.values()];
    const users = new Set(validated.map((event) => event.usuario_id));
    if (userFilter === undefined && users.size > 1) {
      return { ok: false, error: "Filtre por usuario_id para evitar correlacionar actores distintos." };
    }
    if (userFilter !== undefined && validated.some((event) =>
      userFilter === "anonymous" ? event.usuario_id !== null : Number(event.usuario_id) !== Number(userFilter),
    )) {
      return { ok: false, error: "Los eventos enviados no corresponden al usuario_id indicado." };
    }
    return {
      ok: true,
      events: validated,
      usuario_id: userFilter === undefined
        ? validated[0]?.usuario_id ?? null
        : userFilter === "anonymous" ? null : Number(userFilter),
    };
  }

  const stored = listEvents({
    usuario_id: userFilter,
    service: body?.service,
    tipo_evento: body?.tipo_evento,
    from: body?.from,
    to: body?.to,
  });
  const users = new Set(stored.map((event) => event.usuario_id));
  if (userFilter === undefined && users.size > 1) {
    return { ok: false, error: "Filtre por usuario_id para evitar correlacionar actores distintos." };
  }
  return {
    ok: true,
    events: stored,
    usuario_id: userFilter === undefined ? stored[0]?.usuario_id ?? null : userFilter === "anonymous" ? null : Number(userFilter),
  };
}

app.post("/correlations/analyze", (req, res) => {
  const resolved = resolveEvents(req.body || {});
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }
  if (!resolved.events.length) {
    return res.status(422).json({ error: "No hay eventos para correlacionar." });
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
  if (!resolved.events.length) {
    return res.status(422).json({ error: "No hay eventos para generar características." });
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
  if (!resolved.events.length) {
    return res.status(422).json({ error: "No hay eventos para clasificar." });
  }

  const analysis = correlate(resolved.events, {
    usuario_id: resolved.usuario_id,
    reference_timestamp: req.body?.reference_timestamp,
  });
  const analysisId = randomUUID();
  const eventIds = resolved.events.map((event) => event.event_id);
  const interval = {
    from: resolved.events.reduce((min, event) =>
      Date.parse(event.timestamp) < Date.parse(min) ? event.timestamp : min,
    resolved.events[0].timestamp),
    to: resolved.events.reduce((max, event) =>
      Date.parse(event.timestamp) > Date.parse(max) ? event.timestamp : max,
    resolved.events[0].timestamp),
  };

  try {
    const response = await fetch(`${aiServiceUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...analysis.features, input_id: analysisId }),
      signal: AbortSignal.timeout(5000),
    });
    let classification;
    try {
      classification = await response.json();
    } catch {
      return res.status(502).json({ error: "ai-service devolvió una respuesta no JSON.", analysis_id: analysisId });
    }
    if (!response.ok) {
      const errorMessage = classification?.detail || classification?.error;
      return res.status(response.status === 409 ? 409 : 502).json({
        error: typeof errorMessage === "string" ? errorMessage : "ai-service no pudo clasificar las características.",
        analysis_id: analysisId,
        correlation: analysis,
        classification_error: classification,
      });
    }
    if (
      !classification ||
      !["NORMAL", "ANOMALO"].includes(classification.clasificacion) ||
      classification.input_id !== analysisId ||
      typeof classification.model_version !== "string" ||
      typeof classification.probability_semantics !== "string" ||
      typeof classification.nivel_riesgo !== "string" ||
      !Array.isArray(classification.factores) ||
      !Array.isArray(classification.camino_arbol) ||
      (classification.probabilidad !== undefined &&
        (typeof classification.probabilidad !== "number" ||
          classification.probabilidad < 0 ||
          classification.probabilidad > 1))
    ) {
      return res.status(502).json({ error: "ai-service devolvió una clasificación malformada.", analysis_id: analysisId });
    }
    const trace = {
      analysis_id: analysisId,
      generated_at: new Date().toISOString(),
      interval,
      usuario_id: analysis.usuario_id,
      event_ids: eventIds,
      correlation: analysis,
      classification,
    };
    try {
      addAnalysis(trace);
    } catch (error) {
      console.error("No se pudo persistir el resultado de clasificación.", {
        analysis_id: analysisId,
        error: error instanceof Error ? error.message : "error de almacenamiento",
      });
      return res.status(503).json({ error: "No se pudo persistir el resultado del análisis.", analysis_id: analysisId });
    }
    return res.json({
      ...trace,
      classification,
    });
  } catch (error) {
    const timedOut = error && error.name === "TimeoutError";
    return res.status(503).json({
      error: timedOut ? "Tiempo de espera agotado consultando ai-service." : "ai-service no disponible.",
      analysis_id: analysisId,
    });
  }
});

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`logic-correlation-service listening on ${port}`);
  });
}

module.exports = app;
