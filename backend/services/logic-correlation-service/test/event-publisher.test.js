const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sposabella-outbox-"));
process.env.SYSTEM_EVENT_SERVICE = "users-service";
process.env.CORRELATION_SERVICE_URL = "http://correlation.test";
process.env.EVENT_OUTBOX_PATH = path.join(dataDir, "outbox.json");
const originalFetch = global.fetch;
let fetchCalls = 0;
let responseMode = "retry";
global.fetch = async (_url, options) => {
  fetchCalls += 1;
  const event = JSON.parse(options.body);
  assert.equal(event.service, "users-service");
  assert.equal(event.usuario_id, null);
  assert.equal(event.metadata.password, undefined);
  if (responseMode === "retry" && fetchCalls === 1) return { status: 503 };
  return {
    status: 201,
    json: async () => ({
      event_id: responseMode === "invalid-ack" ? "another-event" : event.event_id,
      ingest_status: "created",
    }),
  };
};
const { publishSystemEvent, flushOutbox } = require("../../../contracts/event-publisher");

test("la emisión persiste y reintenta el mismo evento sin filtrar secretos", async () => {
  publishSystemEvent({
    tipo_evento: "LOGIN_FALLIDO",
    entidad: "auth_attempt",
    resultado: "FALLIDO",
    metadata: { password: "do-not-persist", motivo: "credenciales_invalidas" },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const retainedAfterFailure = JSON.parse(
    fs.readFileSync(process.env.EVENT_OUTBOX_PATH, "utf8"),
  );
  assert.equal(retainedAfterFailure.length, 1);
  await flushOutbox();

  assert.ok(fetchCalls >= 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(process.env.EVENT_OUTBOX_PATH, "utf8")), []);
});

test("no encola eventos que incumplen el contrato compartido", () => {
  publishSystemEvent({
    event_id: "evt-invalid-contract",
    tipo_evento: "TIPO_DESCONOCIDO",
    entidad: "venta",
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(process.env.EVENT_OUTBOX_PATH, "utf8")), []);
});

test("conserva un evento si la respuesta HTTP no confirma su identidad", async () => {
  responseMode = "invalid-ack";
  fetchCalls = 0;
  publishSystemEvent({
    event_id: "evt-invalid-ack",
    tipo_evento: "LOGIN_FALLIDO",
    entidad: "auth_attempt",
    resultado: "FALLIDO",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushOutbox();

  const pending = JSON.parse(fs.readFileSync(process.env.EVENT_OUTBOX_PATH, "utf8"));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].event_id, "evt-invalid-ack");

  responseMode = "valid";
  await flushOutbox();
  assert.deepEqual(JSON.parse(fs.readFileSync(process.env.EVENT_OUTBOX_PATH, "utf8")), []);
});

after(() => {
  global.fetch = originalFetch;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
