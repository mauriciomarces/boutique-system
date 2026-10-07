const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../src/index");
const { reset } = require("../src/store");

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

test("GET /health", async (t) => {
  reset();
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "GET", "/health");
  assert.equal(result.status, 200);
  assert.equal(result.data.service, "logic-correlation-service");
});

test("POST /events valida y almacena", async (t) => {
  reset();
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "POST", "/events", {
    event_id: "evt-001",
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
});

test("POST /features/generate a partir de eventos enviados", async (t) => {
  reset();
  const { server, port } = await listen();
  t.after(() => server.close());
  const result = await request(port, "POST", "/features/generate", {
    events: [
      {
        event_id: "a",
        usuario_id: 10,
        tipo_evento: "LOGIN",
        entidad: "sesion",
        entidad_id: 1,
        timestamp: "2026-09-19T18:00:00Z",
        resultado: "EXITOSO",
      },
      {
        event_id: "b",
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
