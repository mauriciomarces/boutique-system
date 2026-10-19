const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sposabella-correlation-"));
process.env.CORRELATION_DATA_DIR = dataDir;

const legacyEvent = {
  event_id: "legacy-event",
  service: "users-service",
  usuario_id: null,
  tipo_evento: "LOGIN_FALLIDO",
  entidad: "auth_attempt",
  entidad_id: null,
  timestamp: "2026-09-19T18:00:00.000Z",
  resultado: "FALLIDO",
  metadata: {},
};
const legacyAnalysis = {
  analysis_id: "legacy-analysis",
  generated_at: "2026-09-19T18:01:00.000Z",
  usuario_id: null,
  event_ids: [legacyEvent.event_id],
};
fs.writeFileSync(path.join(dataDir, "events.jsonl"), `${JSON.stringify(legacyEvent)}\n`);
fs.writeFileSync(path.join(dataDir, "analyses.jsonl"), `${JSON.stringify(legacyAnalysis)}\n`);

const app = require("../src/index");
const store = require("../src/store");
const { reset } = store;
let restartedStore;

function listen() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function request(port, method, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}

test("migra los diarios JSONL existentes sin eliminarlos", () => {
  assert.deepEqual(store.listEvents(), [legacyEvent]);
  assert.deepEqual(store.listAnalyses(), [legacyAnalysis]);
  assert.equal(fs.existsSync(path.join(dataDir, "events.jsonl")), true);
  assert.equal(fs.existsSync(path.join(dataDir, "analyses.jsonl")), true);
  reset({ clearPersistence: true });
});

test("GET /health", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "GET", "/health");
  assert.equal(result.status, 200);
  assert.equal(result.data.service, "logic-correlation-service");
});

test("POST /events valida y almacena", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "POST", "/events", {
    event_id: "evt-001",
    service: "sales-service",
    usuario_id: 10,
    tipo_evento: "VENTA_CREADA",
    entidad: "venta",
    entidad_id: 150,
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "EXITOSO",
    ip: "192.168.1.20",
    metadata: {},
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.event_id, "evt-001");
  assert.equal(result.data.usuario_id, 10);
  assert.equal(result.data.ingest_status, "created");
});

test("POST /events rechaza un evento inválido", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "POST", "/events", {
    event_id: "bad",
    service: "users-service",
    tipo_evento: "LOGIN",
    entidad: "auth_attempt",
    timestamp: "not-a-date",
    resultado: "EXITOSO",
  });
  assert.equal(result.status, 400);
});

test("POST /events es idempotente y detecta conflictos por event_id", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const event = {
    event_id: "evt-duplicate",
    service: "users-service",
    usuario_id: null,
    tipo_evento: "LOGIN_FALLIDO",
    entidad: "auth_attempt",
    timestamp: new Date().toISOString(),
    resultado: "FALLIDO",
  };
  assert.equal((await request(port, "POST", "/events", event)).status, 201);
  const duplicate = await request(port, "POST", "/events", event);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.ingest_status, "duplicate");
  assert.equal((await request(port, "POST", "/events", {
    ...event,
    resultado: "EXITOSO",
  })).status, 409);
});

test("la recuperación del almacén conserva eventos tras recargar el módulo", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const event = {
    event_id: "evt-restart",
    service: "products-service",
    usuario_id: 4,
    tipo_evento: "PRODUCTO_CREADO",
    entidad: "producto",
    entidad_id: 8,
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "EXITOSO",
    metadata: { password: "never-store", categoria_id: 2 },
  };
  await request(port, "POST", "/events", event);
  assert.equal(store.listEvents().length, 1);
  delete require.cache[require.resolve("../src/store")];
  restartedStore = require("../src/store");
  assert.equal(restartedStore.listEvents().length, 1);
  assert.equal(restartedStore.listEvents()[0].metadata.password, undefined);
  assert.equal(restartedStore.addEvent(restartedStore.listEvents()[0]).status, "duplicate");
  restartedStore.reset({ clearPersistence: true });
});

test("la clasificación se enlaza con eventos, características y se persiste", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  await request(port, "POST", "/events", {
    event_id: "evt-trace",
    service: "users-service",
    usuario_id: 10,
    tipo_evento: "LOGIN",
    entidad: "auth_attempt",
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "EXITOSO",
  });

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/predict")) {
      assert.equal(JSON.parse(options.body).event_count_10m, 1);
      assert.ok(JSON.parse(options.body).input_id);
      return new Response(JSON.stringify({
        clasificacion: "NORMAL",
        nivel_riesgo: "BAJO",
        probabilidad: 0.1,
        probability_semantics: "estimación experimental",
        model_version: "v1",
        input_id: JSON.parse(options.body).input_id,
        factores: [],
        camino_arbol: ["event_count_10m <= 2.5"],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  t.after(() => { global.fetch = originalFetch; });

  const result = await request(port, "POST", "/analyze-and-classify", { usuario_id: 10 });
  assert.equal(result.status, 200);
  assert.equal(result.data.event_ids[0], "evt-trace");
  assert.equal(result.data.classification.model_version, "v1");
  assert.equal(result.data.classification.input_id, result.data.analysis_id);
  assert.ok(result.data.correlation.features.event_count_10m);
  const history = await request(port, "GET", "/analyses");
  assert.equal(history.data.analyses[0].analysis_id, result.data.analysis_id);
});

test("no correlaciona en una sola predicción eventos de distintos usuarios", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const base = {
    service: "users-service",
    tipo_evento: "LOGIN_FALLIDO",
    entidad: "auth_attempt",
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "FALLIDO",
  };
  await request(port, "POST", "/events", { ...base, event_id: "actor-1", usuario_id: 1 });
  await request(port, "POST", "/events", { ...base, event_id: "actor-2", usuario_id: 2 });
  const result = await request(port, "POST", "/features/generate", {});
  assert.equal(result.status, 400);
  assert.match(result.data.error, /Filtre por usuario_id/);
});

test("devuelve el error del servicio de IA cuando no existe modelo entrenado", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  await request(port, "POST", "/events", {
    event_id: "evt-untrained",
    service: "users-service",
    usuario_id: 21,
    tipo_evento: "LOGIN",
    entidad: "auth_attempt",
    timestamp: new Date().toISOString(),
    resultado: "EXITOSO",
  });
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/predict")) {
      return new Response(JSON.stringify({ detail: "No hay modelo entrenado." }), { status: 409 });
    }
    return originalFetch(url, options);
  };
  t.after(() => { global.fetch = originalFetch; });

  const result = await request(port, "POST", "/analyze-and-classify", { usuario_id: 21 });
  assert.equal(result.status, 409);
  assert.equal(result.data.error, "No hay modelo entrenado.");
  assert.ok(result.data.analysis_id);
});

test("POST /features/generate a partir de eventos enviados", async (t) => {
  reset({ clearPersistence: true });
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "POST", "/features/generate", {
    events: [
      {
        event_id: "a",
        service: "users-service",
        usuario_id: 10,
        tipo_evento: "LOGIN",
        entidad: "sesion",
        entidad_id: 1,
        timestamp: "2026-09-19T18:00:00Z",
        resultado: "EXITOSO",
      },
      {
        event_id: "b",
        service: "sales-service",
        usuario_id: 10,
        tipo_evento: "VENTA_CREADA",
        entidad: "venta",
        entidad_id: 2,
        timestamp: "2026-09-19T18:03:00Z",
        resultado: "EXITOSO",
      },
    ],
  });

  assert.equal(result.status, 200);
  assert.ok(result.data.features.event_count_10m >= 2);
});

test("la entrada de análisis deduplica reintentos idénticos y rechaza colisiones", async (t) => {
  const { server, port } = await listen();
  t.after(() => server.close());
  const event = {
    event_id: "same-event",
    service: "users-service",
    usuario_id: 10,
    tipo_evento: "LOGIN",
    entidad: "sesion",
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "EXITOSO",
  };

  const duplicate = await request(port, "POST", "/features/generate", {
    events: [event, { ...event }],
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.features.event_count_10m, 1);

  const conflict = await request(port, "POST", "/features/generate", {
    events: [event, { ...event, tipo_evento: "LOGOUT" }],
  });
  assert.equal(conflict.status, 400);
  assert.match(conflict.data.error, /event_id repetido/);
});

after(() => {
  restartedStore?.close();
  store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
