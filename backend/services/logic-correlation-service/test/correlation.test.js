const { test } = require("node:test");
const assert = require("node:assert/strict");
const { correlate } = require("../src/correlation");
const { validateEvent } = require("../src/validate");
const { EVENT_TYPES } = require("../src/constants");

function event(overrides) {
  return {
    event_id: overrides.event_id || `evt-${Math.random()}`,
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

test("regla R3: modificación de stock seguida de venta", () => {
  const analysis = correlate([
    event({ event_id: "l", tipo_evento: "LOGIN", timestamp: "2026-09-19T18:00:00Z" }),
    event({
      event_id: "st",
      tipo_evento: "STOCK_MODIFICADO",
      entidad: "producto",
      entidad_id: 9,
      timestamp: "2026-09-19T18:01:00Z",
    }),
    event({
      event_id: "v",
      tipo_evento: "VENTA_CREADA",
      entidad: "venta",
      entidad_id: 20,
      timestamp: "2026-09-19T18:03:00Z",
    }),
  ]);
  assert.equal(analysis.rules.R3.fired, true);
  assert.equal(analysis.features.sales_after_stock_change, 1);
});

test("regla R4: modificación de precio seguida de venta", () => {
  const analysis = correlate([
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
  ]);
  assert.equal(analysis.rules.R4.fired, true);
  assert.equal(analysis.features.sales_after_price_change, 1);
});
