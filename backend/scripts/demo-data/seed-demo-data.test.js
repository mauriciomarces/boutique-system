const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { correlate } = require("../../services/logic-correlation-service/src/correlation");
const {
  BASE_TIME,
  buildEvents,
  buildScenarioEvents,
  buildSaleFixtures,
  createRng,
  customerFixture,
  initializeEventSchema,
  parseArgs,
  parseDatabaseUrl,
  productFixture,
  persistEvents,
  requireApplyConfirmation,
  removeSeedEvents,
  safeDatabaseName,
  sanitizedErrorMessage,
  seedKey,
  staffFixture,
  supplierFixture,
} = require("./seed-demo-data");

test("the default command is preview-only and requires an explicit service", () => {
  assert.throws(() => parseArgs([]), /--service/);
  const options = parseArgs(["--service", "all"]);
  assert.equal(options.apply, false);
  assert.equal(options.seed, 42);
  assert.equal(options.eventSeed, 42);
  assert.equal(options.count, 3);
});

test("apply is opt-in and cleanup cannot run without apply", () => {
  assert.equal(parseArgs(["--service", "users", "--apply"]).apply, true);
  assert.throws(
    () => parseArgs(["--service", "users", "--cleanup"]),
    /requiere --apply/,
  );
  assert.throws(
    () => parseArgs(["--service", "all", "--count", "101"]),
    /entre 1 y 100/,
  );
  assert.throws(
    () => parseArgs(["--service", "all", "--count", "1", "--scenario", "both"]),
    /al menos 2/,
  );
  assert.throws(
    () => parseArgs(["--service", "all", "--allow-operational"]),
    /--events-output/,
  );
  assert.throws(
    () => parseArgs(["--service", "events", "--event-seed", "bad"]),
    /--event-seed/,
  );
});

test("event identifiers can use a separate seed from their linked business fixtures", () => {
  const options = parseArgs([
    "--service", "events",
    "--seed", "20261125",
    "--event-seed", "20261126",
  ]);
  assert.equal(options.seed, 20261125);
  assert.equal(options.eventSeed, 20261126);
});

test("database names must identify isolated test targets", () => {
  assert.equal(safeDatabaseName("boutique_sales_demo"), true);
  assert.equal(safeDatabaseName("boutique_sales_integration"), true);
  assert.equal(safeDatabaseName("boutique_sales"), false);
  assert.equal(safeDatabaseName("boutique_sales_demo; DROP TABLE users"), false);
});

test("event keys are deterministic and unique per scenario", () => {
  const normal = buildEvents({
    seed: 17,
    scenario: "normal",
    referenceTime: BASE_TIME,
    usuarioId: 7,
    saleIds: ["51"],
    variantIds: ["82"],
  });
  assert.deepEqual(normal.map((event) => event.tipo_evento), ["VENTA_CREADA", "STOCK_MODIFICADO"]);
  assert.equal(normal[1].metadata.venta_id, "51");
  assert.equal(normal[0].usuario_id, normal[1].usuario_id);
  assert.equal(normal[0].event_id, "demo-17-normal-sale");
  assert.equal(normal[1].metadata.fixture, "demo-seed");
});

test("anomaly event fixture crosses the actual correlation thresholds", () => {
  const events = buildEvents({
    seed: 3,
    scenario: "anomalous",
    referenceTime: BASE_TIME,
    usuarioId: 9,
    saleIds: ["1", "2", "3"],
    variantIds: ["10"],
  });
  assert.equal(events.filter((event) => event.tipo_evento === "LOGIN_FALLIDO").length, 5);
  assert.equal(events.filter((event) => event.tipo_evento === "VENTA_ANULADA").length, 3);
  assert.equal(events.filter((event) => event.tipo_evento === "USUARIO_MODIFICADO").length, 3);
  assert.ok(events.every((event) => event.usuario_id === 9));
  assert.ok(events.every((event) => event.metadata.scenario === "anomalous"));
});

test("normal and anomalous events use separate synthetic actors", () => {
  const events = buildScenarioEvents({
    seed: 33,
    scenario: "both",
    referenceTime: BASE_TIME,
    users: [7, 8],
    saleIds: ["51", "52", "53"],
    variantIds: ["82"],
  });
  const normal = events.filter((event) => event.metadata.scenario === "normal");
  const anomalous = events.filter((event) => event.metadata.scenario === "anomalous");
  assert.equal(normal.length, 2);
  assert.equal(anomalous.length, 11);
  assert.equal(normal[0].usuario_id, 7);
  assert.ok(normal.every((event) => event.usuario_id === 7));
  assert.ok(anomalous.every((event) => event.usuario_id === 8));
  assert.throws(() => buildScenarioEvents({
    seed: 33,
    scenario: "both",
    referenceTime: BASE_TIME,
    users: [7],
    saleIds: ["51", "52", "53"],
    variantIds: ["82"],
  }), /dos actores/);
});

test("operational connection opt-in accepts only the configured local database", () => {
  const keys = ["USERS_SERVICE_DATABASE_URL", "DEMO_USERS_DATABASE_URL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.DEMO_USERS_DATABASE_URL;
    process.env.USERS_SERVICE_DATABASE_URL =
      "mysql://demo-user:demo-pass@127.0.0.1:3308/boutique_users";
    assert.throws(() => parseDatabaseUrl("users"), /Defina DEMO_USERS_DATABASE_URL/);
    assert.equal(parseDatabaseUrl("users", { allowOperational: true }).database, "boutique_users");

    process.env.USERS_SERVICE_DATABASE_URL =
      "mysql://demo-user:demo-pass@mysql-users:3306/boutique_users";
    const mapped = parseDatabaseUrl("users", { allowOperational: true });
    assert.equal(mapped.host, "127.0.0.1");
    assert.equal(mapped.port, 3308);

    process.env.USERS_SERVICE_DATABASE_URL =
      "mysql://demo-user:demo-pass@127.0.0.1:3309/boutique_users";
    assert.throws(() => parseDatabaseUrl("users", { allowOperational: true }), /base operativa local permitida/);

    process.env.USERS_SERVICE_DATABASE_URL =
      "mysql://demo-user:demo-pass@example.invalid:3308/boutique_users";
    assert.throws(() => parseDatabaseUrl("users", { allowOperational: true }), /base operativa local permitida/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("operational writes require their separate explicit confirmation", () => {
  const previous = process.env.DEMO_OPERATIONAL_SEED_CONFIRM;
  try {
    delete process.env.DEMO_OPERATIONAL_SEED_CONFIRM;
    assert.throws(
      () => requireApplyConfirmation({ apply: true, allowOperational: true }),
      /DEMO_OPERATIONAL_SEED_CONFIRM/,
    );
    process.env.DEMO_OPERATIONAL_SEED_CONFIRM = "I_UNDERSTAND_LOCAL_OPERATIONAL_SYNTHETIC_DATA";
    assert.doesNotThrow(() => requireApplyConfirmation({ apply: true, allowOperational: true }));
  } finally {
    if (previous === undefined) delete process.env.DEMO_OPERATIONAL_SEED_CONFIRM;
    else process.env.DEMO_OPERATIONAL_SEED_CONFIRM = previous;
  }
});

test("database URLs are sanitized from operational error messages", () => {
  const key = "USERS_SERVICE_DATABASE_URL";
  const previous = process.env[key];
  const url = "mysql://demo-user:demo-pass@127.0.0.1:3308/boutique_users";
  try {
    process.env[key] = url;
    const message = sanitizedErrorMessage(new Error(`Unable to connect: ${url}`));
    assert.doesNotMatch(message, /demo-user|demo-pass|boutique_users/);
    assert.match(message, /URL de conexión oculta/);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test("event fixture refuses incomplete linked data", () => {
  assert.throws(() => buildEvents({
    seed: 3,
    scenario: "anomalous",
    referenceTime: BASE_TIME,
    usuarioId: null,
    saleIds: ["1"],
    variantIds: [],
  }), /al menos tres ventas/);
  assert.equal(seedKey(3, "events", "event", "one"), "3:events:event:one");
});

test("the seed initializes reproducible random values", () => {
  const valuesFor = (seed) => {
    const random = createRng(seed);
    return Array.from({ length: 5 }, () => random());
  };
  assert.deepEqual(valuesFor(19), valuesFor(19));
  assert.notDeepEqual(valuesFor(19), valuesFor(20));
});

test("business fixtures use plausible names and descriptions without test labels", () => {
  const staff = staffFixture(20261125, 0);
  const customer = customerFixture(20261125, 0);
  const [productName, productDescription] = productFixture(20261125, 0);

  assert.match(`${staff.nombre} ${staff.apellido}`, /^[A-ZÁÉÍÓÚÑa-záéíóúñ ]+$/);
  assert.match(`${customer.nombre} ${customer.apellido}`, /^[A-ZÁÉÍÓÚÑa-záéíóúñ ]+$/);
  assert.doesNotMatch(
    `${staff.nombre} ${staff.apellido} ${customer.nombre} ${customer.apellido} ${productName} ${productDescription} ${supplierFixture(20261125)}`,
    /prueba|ficticio|demo|demostración|sintético/i,
  );
  assert.equal(staffFixture(20261125, 0).emailName, staff.emailName);
  assert.notEqual(staff.emailName, customer.emailName);
});

test("sales fixtures repeat by seed and keep extended price arithmetic coherent", () => {
  const first = buildSaleFixtures(73, ["101", "102", "103"]);
  const second = buildSaleFixtures(73, ["101", "102", "103"]);
  assert.deepEqual(first, second);
  for (const sale of first) {
    assert.ok(sale.quantity >= 1 && sale.quantity <= 2);
    assert.equal(Number(sale.amount), sale.unitPrice * sale.quantity);
  }
});

test("normal and anomalous fixtures exercise distinct correlation rules", () => {
  const normal = buildEvents({
    seed: 11,
    scenario: "normal",
    referenceTime: BASE_TIME,
    usuarioId: 7,
    saleIds: ["51"],
    variantIds: ["82"],
  });
  const normalAnalysis = correlate(normal, {
    usuario_id: 7,
    reference_timestamp: BASE_TIME,
  });
  assert.equal(normalAnalysis.rules.R3.fired, true);
  assert.equal(normalAnalysis.rules.R1.fired, false);
  assert.equal(normalAnalysis.rules.R2.fired, false);

  const anomalous = buildEvents({
    seed: 12,
    scenario: "anomalous",
    referenceTime: BASE_TIME,
    usuarioId: 8,
    saleIds: ["61", "62", "63"],
    variantIds: ["82"],
  });
  const anomalyAnalysis = correlate(anomalous, {
    usuario_id: 8,
    reference_timestamp: BASE_TIME,
  });
  assert.equal(anomalyAnalysis.rules.R1.fired, true);
  assert.equal(anomalyAnalysis.rules.R2.fired, true);
  assert.equal(anomalyAnalysis.rules.R5.fired, true);
  assert.equal(anomalyAnalysis.rules.R6.fired, true);
});

test("event persistence is idempotent and cleanup preserves unowned events", () => {
  const database = new DatabaseSync(":memory:");
  initializeEventSchema(database);
  const events = buildEvents({
    seed: 21,
    scenario: "normal",
    referenceTime: BASE_TIME,
    usuarioId: 7,
    saleIds: ["51"],
    variantIds: ["82"],
  });
  try {
    persistEvents(database, 21, events);
    persistEvents(database, 21, events);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM events").get().count, 2);

    database.prepare(`
      INSERT INTO events (
        event_id, service, usuario_id, tipo_evento, entidad, entidad_id,
        timestamp, resultado, metadata_json, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("unowned", "users-service", null, "LOGIN", "usuario", null, BASE_TIME, "EXITOSO", "{}", "{}");
    removeSeedEvents(database, 21);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM events").get().count, 1);
    assert.equal(database.prepare("SELECT event_id FROM events").get().event_id, "unowned");
  } finally {
    database.close();
  }
});

test("event cleanup refuses fixtures referenced by a persisted analysis", () => {
  const database = new DatabaseSync(":memory:");
  initializeEventSchema(database);
  const events = buildEvents({
    seed: 22,
    scenario: "normal",
    referenceTime: BASE_TIME,
    usuarioId: 7,
    saleIds: ["51"],
    variantIds: ["82"],
  });
  try {
    persistEvents(database, 22, events);
    database.prepare(
      "INSERT INTO analyses (analysis_id, generated_at, usuario_id, analysis_json) VALUES (?, ?, ?, ?)",
    ).run("analysis-demo", BASE_TIME, 7, JSON.stringify({ event_ids: [events[0].event_id] }));
    assert.throws(() => removeSeedEvents(database, 22), /incluidos en análisis/);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM events").get().count, 2);
  } finally {
    database.close();
  }
});
