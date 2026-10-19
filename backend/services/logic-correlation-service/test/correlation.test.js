const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { correlate, windowEvents } = require("../src/correlation");
const { validateEvent } = require("../src/validate");
const { EVENT_TYPES, REQUIRED_EVENT_FIELDS } = require("../src/constants");
const systemEventSchema = require("../../../contracts/system-event.schema.json");
const { verifiedActorId } = require("../../../contracts/event-actor");

function event(overrides) {
  return {
    event_id: overrides.event_id || `evt-${Math.random()}`,
    service: "users-service",
    usuario_id: 10,
    tipo_evento: EVENT_TYPES.LOGIN,
    entidad: "sesion",
    entidad_id: 1,
    timestamp: "2026-09-19T18:00:00Z",
    resultado: "EXITOSO",
    ip: "192.168.1.20",
    metadata: {},
    ...overrides,
  };
}

test("valida un evento correcto y rechaza campos sensibles innecesarios", () => {
  const result = validateEvent(
    event({
      metadata: { password: "secret", motivo: "ajuste" },
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.event.metadata.password, undefined);
  assert.equal(result.event.metadata.motivo, "ajuste");
});

test("el contrato admite eventos sin usuario identificable", () => {
  const result = validateEvent(event({
    event_id: "anonymous-login",
    usuario_id: null,
    tipo_evento: "LOGIN_FALLIDO",
    resultado: "FALLIDO",
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.usuario_id, null);
});

test("el JSON Schema no inventa usuario_id y exige service", () => {
  assert.ok(systemEventSchema.required.includes("service"));
  assert.ok(!systemEventSchema.required.includes("usuario_id"));
  assert.ok(systemEventSchema.properties.usuario_id.type.includes("null"));
});

test("el validador comparte tipos y rechaza metadata estructurada no permitida", () => {
  assert.deepEqual(
    [...systemEventSchema.properties.tipo_evento.enum].sort(),
    Object.values(EVENT_TYPES).sort(),
  );
  assert.deepEqual([...systemEventSchema.required].sort(), [...REQUIRED_EVENT_FIELDS].sort());
  assert.equal(
    validateEvent(event({ metadata: { referencia: { nested: true } } })).ok,
    false,
  );
});

test("el actor proviene del contexto autenticado y no del cuerpo", () => {
  assert.equal(
    verifiedActorId({
      authenticatedUser: { id: "17" },
      body: { actor_usuario_id: 99 },
    }),
    17,
  );
  assert.equal(verifiedActorId({ body: { actor_usuario_id: 99 } }), null);
  assert.equal(verifiedActorId({ authenticatedUser: { sub: "18" } }), 18);
});

test("secuencia normal LOGIN-VENTA-LOGOUT no dispara reglas anómalas", () => {
  const analysis = correlate([
    event({ event_id: "1", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
    event({
      event_id: "2",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 150,
      timestamp: "2026-09-19T18:04:00Z",
    }),
    event({ event_id: "3", tipo_evento: "LOGOUT", timestamp: "2026-09-19T18:08:00Z" }),
  ]);

  assert.equal(analysis.features.failed_login_rule, 0);
  assert.equal(analysis.features.cancellation_rule, 0);
  assert.equal(analysis.features.stock_sale_rule, 0);
  assert.ok(analysis.features.event_count_10m >= 3);
});

test("ventana temporal de 10 minutos excluye eventos antiguos", () => {
  const analysis = correlate(
    [
      event({ event_id: "old", tipo_evento: "LOGIN_FALLIDO", timestamp: "2026-09-19T17:00:00Z", resultado: "FALLIDO" }),
      event({ event_id: "new", tipo_evento: "LOGIN_FALLIDO", timestamp: "2026-09-19T18:00:00Z", resultado: "FALLIDO" }),
    ],
    { reference_timestamp: "2026-09-19T18:00:00Z" },
  );

  assert.equal(analysis.windows["10m"], 1);
  assert.equal(analysis.features.failed_login_count, 1);
});

test("las ventanas 5, 10, 30 y 60 minutos incluyen su límite exacto", () => {
  const referenceMs = Date.parse("2026-09-19T18:00:00Z");
  const events = [5, 10, 30, 60].map((minutes) => event({
    event_id: `boundary-${minutes}`,
    timestamp: new Date(referenceMs - minutes * 60_000).toISOString(),
  }));
  for (const minutes of [5, 10, 30, 60]) {
    assert.equal(
      windowEvents(events, referenceMs, minutes).some(
        (item) => item.event_id === `boundary-${minutes}`,
      ),
      true,
    );
  }
  assert.equal(
    windowEvents(
      [event({
        event_id: "outside-five",
        timestamp: new Date(referenceMs - 5 * 60_000 - 1).toISOString(),
      })],
      referenceMs,
      5,
    ).length,
    0,
  );
});

test("R1, R2 y R5 cuentan el evento situado exactamente en el inicio de su ventana", () => {
  const events = [
    ...[0, 2, 4, 6, 10].map((minutes, index) => event({
      event_id: `boundary-login-${index}`,
      tipo_evento: "LOGIN_FALLIDO",
      resultado: "FALLIDO",
      timestamp: new Date(Date.parse("2026-09-19T18:00:00Z") - minutes * 60_000).toISOString(),
    })),
    ...[0, 15, 30].map((minutes, index) => event({
      event_id: `boundary-cancel-${index}`,
      tipo_evento: "VENTA_ANULADA",
      entidad: "venta",
      resultado: "EXITOSO",
      timestamp: new Date(Date.parse("2026-09-19T18:00:00Z") - minutes * 60_000).toISOString(),
    })),
    ...[0, 5, 10].map((minutes, index) => event({
      event_id: `boundary-admin-${index}`,
      tipo_evento: "USUARIO_MODIFICADO",
      entidad: "usuario",
      timestamp: new Date(Date.parse("2026-09-19T18:00:00Z") - minutes * 60_000).toISOString(),
    })),
  ];
  const analysis = correlate(events, { reference_timestamp: "2026-09-19T18:00:00Z" });
  assert.equal(analysis.rules.R1.fired, true);
  assert.equal(analysis.rules.R2.fired, true);
  assert.equal(analysis.rules.R5.fired, true);
});

test("regla R1: múltiples intentos fallidos de login", () => {
  const events = [];
  for (let i = 0; i < 5; i += 1) {
    events.push(
      event({
        event_id: `fail-${i}`,
        tipo_evento: "LOGIN_FALLIDO",
        resultado: "FALLIDO",
        timestamp: `2026-09-19T18:0${i}:00Z`,
      }),
    );
  }
  events.push(event({ event_id: "ok", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:06:00Z" }));
  const analysis = correlate(events);
  assert.equal(analysis.rules.R1.fired, true);
  assert.equal(analysis.features.failed_login_rule, 1);
  assert.ok(analysis.features.failed_login_count >= 5);
});

test("regla R2: múltiples anulaciones de venta", () => {
  const events = [
    event({ event_id: "l", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
  ];
  for (let i = 0; i < 3; i += 1) {
    events.push(
      event({
        event_id: `s-${i}`,
        tipo_evento: "VENTA_CREADA",
        entidad: "venta",
        entidad_id: 100 + i,
        timestamp: `2026-09-19T18:${String(2 + i * 4).padStart(2, "0")}:00Z`,
      }),
    );
    events.push(
      event({
        event_id: `c-${i}`,
        tipo_evento: "VENTA_ANULADA",
        entidad: "venta",
        entidad_id: 100 + i,
        timestamp: `2026-09-19T18:${String(3 + i * 4).padStart(2, "0")}:00Z`,
      }),
    );
  }
  const analysis = correlate(events);
  assert.equal(analysis.rules.R2.fired, true);
  assert.ok(analysis.features.cancellation_ratio > 0);
});

test("correlaciona la salida de stock con su venta por referencia aunque se emita después", () => {
  const analysis = correlate([
    event({
      event_id: "st",
      tipo_evento: "STOCK_MODIFICADO",
      entidad: "variante_producto",
      entidad_id: 9,
      timestamp: "2026-09-19T18:01:00.270Z",
      metadata: {
        tipo_movimiento: "SALIDA",
        referencia_tipo: "VENTA",
        venta_id: "20",
      },
    }),
    event({
      event_id: "v",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 20,
      timestamp: "2026-09-19T18:01:00Z",
    }),
    event({ event_id: "l", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
  ]);
  assert.equal(analysis.rules.R3.fired, true);
  assert.equal(analysis.features.sales_after_stock_change, 1);
  assert.equal(analysis.rules.R3.value, 1);
  assert.equal(analysis.relations.stock_to_sale[0].venta_id, "20");
});

test("el cambio de precio permanece contextual y no activa una regla de riesgo", () => {
  const events = [
    event({ event_id: "l", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
    event({
      event_id: "p",
      tipo_evento: "PRECIO_MODIFICADO",
      entidad: "producto",
      entidad_id: 9,
      timestamp: "2026-09-19T18:01:00Z",
    }),
    event({
      event_id: "v",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 21,
      timestamp: "2026-09-19T18:04:00Z",
    }),
  ];
  const analysis = correlate(events);
  assert.equal(analysis.rules.R4.fired, false);
  assert.equal(analysis.features.price_sale_rule, 0);
  assert.equal(analysis.features.sales_after_price_change, 1);
  assert.equal(analysis.features.risk_rule_count, 0);
  const differentActor = correlate(
    events.map((item) => item.event_id === "p" ? { ...item, usuario_id: 11 } : item),
  );
  assert.equal(differentActor.features.sales_after_price_change, 0);
});

test("no asocia movimientos de otra venta, actor, variante o fuera de la ventana", () => {
  const sale = event({
    event_id: "sale-20",
    usuario_id: 10,
    tipo_evento: "VENTA_CREADA",
    entidad: "venta",
    entidad_id: 20,
    timestamp: "2026-09-19T18:00:00Z",
  });
  const movement = (overrides) => event({
    event_id: "stock-20",
    usuario_id: 10,
    tipo_evento: "STOCK_MODIFICADO",
    entidad: "variante_producto",
    entidad_id: 9,
    timestamp: "2026-09-19T18:00:01Z",
    metadata: {
      tipo_movimiento: "SALIDA",
      referencia_tipo: "VENTA",
      venta_id: "20",
    },
    ...overrides,
  });

  for (const invalidMovement of [
    movement({ metadata: { tipo_movimiento: "SALIDA", referencia_tipo: "VENTA", venta_id: "21" } }),
    movement({ usuario_id: 11 }),
    movement({ timestamp: "2026-09-19T18:15:00Z" }),
    movement({ metadata: { tipo_movimiento: "ENTRADA", referencia_tipo: "VENTA", venta_id: "20" } }),
  ]) {
    assert.equal(correlate([invalidMovement, sale]).features.sales_after_stock_change, 0);
  }

  const duplicate = movement({ event_id: "stock-20" });
  const valid = movement({});
  assert.equal(correlate([sale, valid, duplicate]).features.sales_after_stock_change, 1);
});

test("preserva las variantes de salidas asociadas a ventas distintas", () => {
  const sales = [20, 21].map((saleId, index) => event({
    event_id: `sale-${saleId}`,
    tipo_evento: "VENTA_CREADA",
    entidad: "venta",
    entidad_id: saleId,
    timestamp: `2026-09-19T18:0${index}:00Z`,
  }));
  const movements = [9, 10].map((variantId, index) => event({
    event_id: `stock-${index}`,
    tipo_evento: "STOCK_MODIFICADO",
    entidad: "variante_producto",
    entidad_id: variantId,
    timestamp: `2026-09-19T18:0${index}:01Z`,
    metadata: {
      tipo_movimiento: "SALIDA",
      referencia_tipo: "VENTA",
      venta_id: String(20 + index),
    },
  }));
  const links = correlate([...sales, ...movements]).relations.stock_to_sale;
  assert.deepEqual(
    links.map((link) => [link.venta_id, link.variante_producto_id]),
    [["20", "9"], ["21", "10"]],
  );
});

test("la extracción Python y el correlador JavaScript producen el mismo vector", (t) => {
  const events = [
    event({ event_id: "login", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
    event({
      event_id: "sale-20",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 20,
      timestamp: "2026-09-19T18:01:00Z",
      metadata: {},
    }),
    event({
      event_id: "stock-20",
      tipo_evento: "STOCK_MODIFICADO",
      entidad: "variante_producto",
      entidad_id: 9,
      timestamp: "2026-09-19T18:01:00.270Z",
      metadata: {
        tipo_movimiento: "SALIDA",
        referencia_tipo: "VENTA",
        venta_id: "20",
      },
    }),
    event({
      event_id: "price",
      tipo_evento: "PRECIO_MODIFICADO",
      entidad: "variante_producto",
      entidad_id: 9,
      timestamp: "2026-09-19T18:02:00Z",
    }),
    event({
      event_id: "sale-21",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 21,
      timestamp: "2026-09-19T18:03:00Z",
    }),
  ];
  events.push({ ...events[1] });
  const aiServiceDir = path.resolve(__dirname, "../../../services/ai-service");
  const script = [
    "import json, sys",
    "from app.features import extract_features",
    "print(json.dumps(extract_features(json.load(sys.stdin)), sort_keys=True))",
  ].join("\n");
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), "sposabella-features-parity-"));
  try {
    const result = spawnSync("python", ["-c", script], {
      cwd: aiServiceDir,
      input: JSON.stringify(events),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_DATA_DIR: path.join(isolatedDir, "data"),
        AI_MODELS_DIR: path.join(isolatedDir, "models"),
        AI_METRICS_DIR: path.join(isolatedDir, "metrics"),
        DATABASE_URL: `sqlite:///${path.join(isolatedDir, "history.sqlite").replace(/\\/g, "/")}`,
      },
    });
    if (result.error?.code === "ENOENT") {
      t.skip("Python no está disponible para verificar la paridad entre runtimes.");
      return;
    }
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), correlate(events).features);
  } finally {
    fs.rmSync(isolatedDir, { recursive: true, force: true });
  }
});

test("excluye operaciones fallidas de las correlaciones de negocio", () => {
  const analysis = correlate([
    event({
      event_id: "stock-fail",
      tipo_evento: "STOCK_MODIFICADO",
      resultado: "FALLIDO",
      timestamp: "2026-09-19T18:01:00Z",
    }),
    event({
      event_id: "sale-fail",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      resultado: "FALLIDO",
      timestamp: "2026-09-19T18:03:00Z",
    }),
  ]);
  assert.equal(analysis.features.sales_count, 0);
  assert.equal(analysis.features.stock_sale_rule, 0);
});
