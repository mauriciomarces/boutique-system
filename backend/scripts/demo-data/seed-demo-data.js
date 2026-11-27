#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { validateEvent } = require("../../services/logic-correlation-service/src/validate");

const ROOT = path.resolve(__dirname, "../../..");
const SERVICES = ["users", "products", "inventory", "sales", "events"];
const CONFIRMATION = "I_UNDERSTAND_TEST_DATABASE_ONLY";
const OPERATIONAL_CONFIRMATION = "I_UNDERSTAND_LOCAL_OPERATIONAL_SYNTHETIC_DATA";
const BASE_TIME = "2026-01-15T12:00:00.000Z";
const OPERATIONAL_DATABASES = {
  users: { name: "boutique_users", port: 3308 },
  products: { name: "boutique_products", port: 3309 },
  inventory: { name: "boutique_inventory", port: 3310 },
  sales: { name: "boutique_sales", port: 3311 },
};
const STAFF_NAMES = [
  ["María José", "Rojas", "Fernández"],
  ["Carlos Eduardo", "Méndez", "Salazar"],
  ["Patricia Alejandra", "Flores", "Quiroga"],
  ["José Luis", "Vargas", "Paredes"],
  ["Claudia Fernanda", "Suárez", "Ríos"],
  ["Marco Antonio", "Morales", "Arce"],
  ["Gabriela Verónica", "Gutiérrez", "Rocha"],
  ["Diego Andrés", "Álvarez", "Pinto"],
  ["Rosa Elena", "Castillo", "Tórrez"],
  ["Andrés Mauricio", "Pacheco", "Lima"],
];
const CUSTOMER_NAMES = [
  ["Camila", "Rojas", "Fernández"],
  ["Valeria", "Mendoza", "Salazar"],
  ["Daniela", "Flores", "Quiroga"],
  ["Andrea", "Vargas", "López"],
  ["Mariana", "Suárez", "Ríos"],
  ["Natalia", "Paredes", "Arce"],
  ["Lucía", "Morales", "Tórrez"],
  ["Paola", "Gutiérrez", "Rocha"],
  ["Fernanda", "Álvarez", "Pinto"],
  ["Gabriela", "Castillo", "Méndez"],
];
const PRODUCT_FIXTURES = [
  ["Vestido midi Aurora", "Vestido midi de corte evasé, adecuado para eventos de día."],
  ["Vestido de fiesta Camila", "Vestido de fiesta con falda fluida y acabado satinado."],
  ["Vestido largo Esmeralda", "Vestido largo con cintura definida y caída ligera."],
  ["Vestido corte A Valentina", "Vestido de corte A con escote discreto y manga corta."],
  ["Vestido floral Primavera", "Vestido estampado de flores con tela liviana."],
  ["Vestido satén Renata", "Vestido de satén con tirantes ajustables y silueta recta."],
  ["Vestido noche Andina", "Vestido largo de noche con detalles bordados."],
  ["Vestido bordado Lucía", "Vestido de ocasión con bordado fino en el cuerpo."],
  ["Vestido plisado Marina", "Vestido plisado con falda a media pierna."],
  ["Vestido elegante Isabela", "Vestido de ocasión con mangas tres cuartos."],
];
const SUPPLIER_NAMES = [
  "Confecciones Altura",
  "Distribuidora Andina de Moda",
  "Textiles Valle Hermoso",
  "Proveedores Santa Cruz",
];
const REGISTRY_DDL = `
  CREATE TABLE IF NOT EXISTS _demo_seed_registry (
    seed_key VARCHAR(191) NOT NULL PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL
  ) ENGINE=InnoDB
`;

function parseArgs(argv) {
  const options = {
    service: null,
    count: 3,
    seed: 42,
    eventSeed: null,
    scenario: "both",
    referenceTime: BASE_TIME,
    apply: false,
    cleanup: false,
    allowOperational: false,
    eventsOutput: null,
  };
  const valueOptions = new Map([
    ["--service", "service"],
    ["--count", "count"],
    ["--seed", "seed"],
    ["--event-seed", "eventSeed"],
    ["--scenario", "scenario"],
    ["--reference-time", "referenceTime"],
    ["--events-output", "eventsOutput"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--cleanup") {
      options.cleanup = true;
    } else if (argument === "--allow-operational") {
      options.allowOperational = true;
    } else if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Falta un valor para ${argument}.`);
      }
      options[valueOptions.get(argument)] = value;
      index += 1;
    } else {
      throw new Error(`Opción desconocida: ${argument}.`);
    }
  }

  options.count = Number(options.count);
  options.seed = Number(options.seed);
  if (options.eventSeed !== null) options.eventSeed = Number(options.eventSeed);
  else options.eventSeed = options.seed;
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100) {
    throw new Error("--count debe ser un entero entre 1 y 100.");
  }
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 2147483647) {
    throw new Error("--seed debe ser un entero entre 0 y 2147483647.");
  }
  if (!Number.isSafeInteger(options.eventSeed) || options.eventSeed < 0 || options.eventSeed > 2147483647) {
    throw new Error("--event-seed debe ser un entero entre 0 y 2147483647.");
  }
  if (!["all", ...SERVICES].includes(options.service)) {
    throw new Error("--service debe ser all, users, products, inventory, sales o events.");
  }
  if (!["normal", "anomalous", "both"].includes(options.scenario)) {
    throw new Error("--scenario debe ser normal, anomalous o both.");
  }
  if (options.scenario === "both" && options.count < 2) {
    throw new Error("--count debe ser al menos 2 para separar los actores normal y anómalo.");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(options.referenceTime) ||
    Number.isNaN(Date.parse(options.referenceTime))
  ) {
    throw new Error("--reference-time debe ser una fecha ISO válida.");
  }
  if (options.cleanup && !options.apply) {
    throw new Error("--cleanup requiere --apply.");
  }
  if (options.allowOperational && options.cleanup) {
    throw new Error("La limpieza de datos operativos está deshabilitada.");
  }
  if (options.allowOperational && ["all", "events"].includes(options.service) && !options.eventsOutput) {
    throw new Error("--allow-operational requiere --events-output para enviar eventos por el servicio real.");
  }
  if (options.eventsOutput && !options.allowOperational) {
    throw new Error("--events-output requiere --allow-operational.");
  }
  if (options.eventsOutput) {
    options.eventsOutput = path.resolve(options.eventsOutput);
    const projectRelative = path.relative(ROOT, options.eventsOutput);
    const isInsideProject =
      projectRelative === "" ||
      (!projectRelative.startsWith(`..${path.sep}`) &&
        projectRelative !== ".." &&
        !path.isAbsolute(projectRelative));
    if (isInsideProject || path.extname(options.eventsOutput).toLowerCase() !== ".json") {
      throw new Error("--events-output debe ser un archivo .json fuera del repositorio.");
    }
  }
  return options;
}

function seedKey(seed, service, type, index) {
  return `${seed}:${service}:${type}:${index}`;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fixtureIndex(seed, index, fixtures) {
  return ((seed % fixtures.length) + index) % fixtures.length;
}

function personFixture(seed, index, names) {
  const [nombre, apellidoPaterno, apellidoMaterno] =
    names[fixtureIndex(seed, index, names)];
  const emailName = `${nombre} ${apellidoPaterno}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
  return {
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    apellido: `${apellidoPaterno} ${apellidoMaterno}`,
    emailName,
  };
}

function staffFixture(seed, index) {
  return personFixture(seed, index, STAFF_NAMES);
}

function customerFixture(seed, index) {
  return personFixture(seed, index, CUSTOMER_NAMES);
}

function productFixture(seed, index) {
  return PRODUCT_FIXTURES[fixtureIndex(seed, index, PRODUCT_FIXTURES)];
}

function supplierFixture(seed) {
  return SUPPLIER_NAMES[seed % SUPPLIER_NAMES.length];
}

function safeDatabaseName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name) && /_(demo|test|integration)$/i.test(name);
}

function parseDatabaseUrl(service, options = {}) {
  const envName = `DEMO_${service.toUpperCase()}_DATABASE_URL`;
  const serviceEnvName = `${service.toUpperCase()}_SERVICE_DATABASE_URL`;
  const rawUrl = process.env[envName] ||
    (options.allowOperational ? process.env[serviceEnvName] : undefined);
  if (!rawUrl) {
    throw new Error(`Defina ${envName} o la URL del servicio correspondiente.`);
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${envName} no es una URL de base de datos válida.`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const operationalTarget = OPERATIONAL_DATABASES[service];
  const serviceHost = `mysql-${service}`;
  const mappedComposeTarget = Boolean(
    options.allowOperational &&
    operationalTarget &&
    database === operationalTarget.name &&
    url.hostname === serviceHost &&
    Number(url.port || 3306) === 3306,
  );
  const isExactOperationalTarget = Boolean(
    options.allowOperational &&
    operationalTarget &&
    database === operationalTarget.name &&
    (
      mappedComposeTarget ||
      (
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        Number(url.port || 3306) === operationalTarget.port
      )
    ),
  );
  const hostAllowed =
    ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(url.hostname) ||
    /\.(test|local)$/i.test(url.hostname) ||
    /^mysql-[a-z-]+$/i.test(url.hostname);

  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error(`${envName} debe usar MySQL/MariaDB.`);
  }
  if (options.allowOperational ? !isExactOperationalTarget : !safeDatabaseName(database)) {
    throw new Error(options.allowOperational
      ? `${envName} solo puede apuntar a la base operativa local permitida para ${service}.`
      : `${envName} debe apuntar a una base cuyo nombre termine en _demo, _test o _integration.`);
  }
  if (!hostAllowed) {
    throw new Error(`${envName} debe apuntar a localhost, una red privada de pruebas o un host Docker de pruebas.`);
  }
  return {
    host: mappedComposeTarget ? "127.0.0.1" : url.hostname,
    port: mappedComposeTarget ? operationalTarget.port : Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectTimeout: 5000,
    bigIntAsNumber: false,
  };
}

function mariadbDriver() {
  const packageJson = path.join(ROOT, "backend", "services", "products-service", "package.json");
  return createRequire(packageJson)("mariadb");
}

async function openDatabase(service, options = {}) {
  const config = parseDatabaseUrl(service, options);
  const connection = await mariadbDriver().createConnection(config);
  const identity = await connection.query("SELECT DATABASE() AS database_name, @@read_only AS read_only");
  if (
    identity[0]?.database_name !== config.database ||
    Number(identity[0]?.read_only) !== 0
  ) {
    await connection.end();
    throw new Error(`${service}: la identidad o el modo de escritura de la conexión no es seguro.`);
  }
  return connection;
}

function timestampFor(referenceTime, minutesBefore = 0) {
  return new Date(Date.parse(referenceTime) - minutesBefore * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function eventTimestamp(referenceTime, minutesBefore) {
  return new Date(Date.parse(referenceTime) - minutesBefore * 60_000).toISOString();
}

function metadataFor(scenario) {
  return { fixture: "demo-seed", scenario };
}

function buildEvents({ seed, scenario, referenceTime, usuarioId, saleIds, variantIds }) {
  const events = [];
  const actorId = usuarioId == null ? null : Number(usuarioId);
  if (actorId !== null && (!Number.isSafeInteger(actorId) || actorId < 0)) {
    throw new Error("El usuario de prueba no puede representarse en el contrato de eventos.");
  }
  const add = (kind, offset, service, type, entity, entityId, result, metadata) => {
    const event = {
      event_id: `demo-${seed}-${scenario}-${kind}`,
      service,
      usuario_id: actorId,
      tipo_evento: type,
      entidad: entity,
      entidad_id: entityId == null ? null : String(entityId),
      timestamp: eventTimestamp(referenceTime, offset),
      resultado: result,
      metadata: { ...metadataFor(scenario), ...metadata },
    };
    const validation = validateEvent(event);
    if (!validation.ok) {
      throw new Error(`Evento sintético inválido (${kind}): ${validation.error}`);
    }
    events.push(validation.event);
  };

  if (scenario === "normal") {
    const saleId = saleIds[0];
    const variantId = variantIds[0];
    if (saleId == null || variantId == null) {
      throw new Error("El escenario normal requiere datos de ventas y variantes del mismo seed.");
    }
    add("sale", 5, "sales-service", "VENTA_CREADA", "venta", saleId, "EXITOSO", {});
    add(
      "stock",
      4,
      "inventory-service",
      "STOCK_MODIFICADO",
      "variante_producto",
      variantId,
      "EXITOSO",
      { referencia_tipo: "VENTA", tipo_movimiento: "SALIDA", venta_id: String(saleId) },
    );
  }

  if (scenario === "anomalous") {
    if (saleIds.length < 3) {
      throw new Error("El escenario anómalo requiere al menos tres ventas de demostración.");
    }
    for (let index = 0; index < 5; index += 1) {
      add(`login-${index + 1}`, 9 - index, "users-service", "LOGIN_FALLIDO", "usuario", null, "FALLIDO", {});
    }
    for (let index = 0; index < 3; index += 1) {
      add(
        `cancel-${index + 1}`,
        3 - index,
        "sales-service",
        "VENTA_ANULADA",
        "venta",
        saleIds[index],
        "EXITOSO",
        {},
      );
    }
    for (let index = 0; index < 3; index += 1) {
      add(
        `admin-${index + 1}`,
        0.9 - index * 0.3,
        "users-service",
        "USUARIO_MODIFICADO",
        "usuario",
        actorId,
        "EXITOSO",
        {},
      );
    }
  }
  return events;
}

function buildScenarioEvents({ seed, scenario, referenceTime, users, saleIds, variantIds }) {
  const scenarios = scenario === "both" ? ["normal", "anomalous"] : [scenario];
  if (scenario === "both" && users.length < 2) {
    throw new Error("Los escenarios normal y anómalo requieren dos actores sintéticos distintos.");
  }
  return scenarios.flatMap((scenarioName) => buildEvents({
    seed,
    scenario: scenarioName,
    referenceTime,
    usuarioId: users[scenarioName === "anomalous" && scenario === "both" ? 1 : 0] ?? null,
    saleIds,
    variantIds,
  }));
}

async function ensureRegistry(connection) {
  await connection.query(REGISTRY_DDL);
}

async function findTracked(connection, key) {
  const rows = await connection.query(
    "SELECT entity_id FROM _demo_seed_registry WHERE seed_key = ?",
    [key],
  );
  return rows[0]?.entity_id ?? null;
}

async function insertTracked(connection, { key, type, table, columns, values }) {
  const existing = await findTracked(connection, key);
  if (existing !== null) {
    const stored = await connection.query(
      `SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [existing],
    );
    if (!stored.length) {
      throw new Error(`El registro asociado a ${type} ya no existe; no se recreará sobre una relación obsoleta.`);
    }
    return { id: String(existing), created: false };
  }

  const placeholders = columns.map(() => "?").join(", ");
  const result = await connection.query(
    `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
    values,
  );
  const id = String(result.insertId);
  await connection.query(
    "INSERT INTO _demo_seed_registry (seed_key, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?)",
    [key, type, id, timestampFor(BASE_TIME)],
  );
  return { id, created: true };
}

async function trackExisting(connection, { key, type, id }) {
  const existing = await findTracked(connection, key);
  if (existing !== null) {
    if (String(existing) !== String(id)) {
      throw new Error(`La relación registrada para ${type} no coincide con el seed actual.`);
    }
    return;
  }
  await connection.query(
    "INSERT INTO _demo_seed_registry (seed_key, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?)",
    [key, type, String(id), timestampFor(BASE_TIME)],
  );
}

function prefixFor(seed, service) {
  return `${seed}:${service}:`;
}

async function recordsFor(connection, seed, service) {
  return connection.query(
    "SELECT seed_key, entity_type, entity_id FROM _demo_seed_registry WHERE seed_key LIKE ? ORDER BY seed_key",
    [`${prefixFor(seed, service)}%`],
  );
}

async function idsForType(connection, seed, service, type) {
  const rows = await connection.query(
    "SELECT entity_id FROM _demo_seed_registry WHERE seed_key LIKE ? AND entity_type = ? ORDER BY seed_key",
    [`${prefixFor(seed, service)}%`, type],
  );
  return rows.map((row) => String(row.entity_id));
}

async function variantsForSeed(seed, count, options = {}) {
  const connection = await openDatabase("products", options);
  try {
    const rows = await connection.query(
      "SELECT seed_key, entity_id FROM _demo_seed_registry WHERE seed_key LIKE ? AND entity_type = 'variant' ORDER BY seed_key",
      [`${seed}:products:variant:%`],
    );
    const byKey = new Map(rows.map((row) => [row.seed_key, String(row.entity_id)]));
    const variants = Array.from({ length: count }, (_, index) =>
      byKey.get(seedKey(seed, "products", "variant", index)),
    );
    if (variants.some((id) => !id)) {
      throw new Error("Faltan variantes propias de este seed. Ejecute primero --service products.");
    }
    const existing = await connection.query(
      `SELECT id FROM variantes WHERE id IN (${variants.map(() => "?").join(", ")})`,
      variants,
    );
    if (existing.length !== variants.length) {
      throw new Error("Una variante registrada por el seed ya no existe; se evitarán referencias huérfanas.");
    }
    return variants;
  } finally {
    await connection.end();
  }
}

async function usersForSeed(seed, options = {}) {
  const connection = await openDatabase("users", options);
  try {
    const ids = await idsForType(connection, seed, "users", "user");
    if (!ids.length) return ids;
    const existing = await connection.query(
      `SELECT id FROM usuarios WHERE id IN (${ids.map(() => "?").join(", ")})`,
      ids,
    );
    if (existing.length !== ids.length) {
      throw new Error("Un usuario registrado por el seed ya no existe.");
    }
    return ids;
  } finally {
    await connection.end();
  }
}

async function salesForSeed(seed, count, options = {}) {
  const connection = await openDatabase("sales", options);
  try {
    const ids = await idsForType(connection, seed, "sales", "sale");
    if (ids.length < count) {
      throw new Error("Faltan ventas de demostración. Ejecute primero --service sales con el mismo seed.");
    }
    const selected = ids.slice(0, count);
    const existing = await connection.query(
      `SELECT id FROM ventas WHERE id IN (${selected.map(() => "?").join(", ")})`,
      selected,
    );
    if (existing.length !== selected.length) {
      throw new Error("Una venta registrada por el seed ya no existe.");
    }
    return selected;
  } finally {
    await connection.end();
  }
}

async function seedUsers(connection, options) {
  const { seed, count } = options;
  const existingRoles = await connection.query(
    "SELECT id FROM roles WHERE nombre = ? LIMIT 1",
    ["AUXILIAR"],
  );
  const role = existingRoles.length
    ? existingRoles[0]
    : await insertTracked(connection, {
        key: seedKey(seed, "users", "role", 0),
        type: "role",
        table: "roles",
        columns: ["nombre", "descripcion", "estado"],
        values: ["AUXILIAR", "Personal de apoyo en la operación de tienda.", "ACTIVO"],
      });
  for (let index = 0; index < count; index += 1) {
    const person = staffFixture(seed, index);
    const user = await insertTracked(connection, {
      key: seedKey(seed, "users", "user", index),
      type: "user",
      table: "usuarios",
      columns: [
        "nombre", "apellido_paterno", "apellido_materno", "apellido", "correo",
        "estado", "creado_en", "actualizado_en", "correo_verificado",
      ],
      values: [
        person.nombre,
        person.apellidoPaterno,
        person.apellidoMaterno,
        person.apellido,
        `${person.emailName}.${seed}.${index + 1}@example.invalid`,
        "INACTIVO",
        timestampFor(options.referenceTime),
        timestampFor(options.referenceTime),
        false,
      ],
    });
    await connection.query(
      "INSERT IGNORE INTO usuario_rol (usuario_id, rol_id) VALUES (?, ?)",
      [user.id, role.id],
    );
    const assigned = await connection.query(
      "SELECT 1 FROM usuario_rol WHERE usuario_id = ? AND rol_id = ?",
      [user.id, role.id],
    );
    if (!assigned.length) {
      throw new Error("No se pudo vincular el rol ficticio con el usuario.");
    }
    await trackExisting(connection, {
      key: seedKey(seed, "users", "user_role", index),
      type: "user_role",
      id: `${user.id}:${role.id}`,
    });
  }
}

async function seedProducts(connection, options) {
  const { seed, count } = options;
  const random = createRng(seed);
  const existingCategories = await connection.query(
    "SELECT id FROM categorias WHERE nombre = ? LIMIT 1",
    ["Vestidos de fiesta"],
  );
  const category = existingCategories.length
    ? existingCategories[0]
    : await insertTracked(connection, {
        key: seedKey(seed, "products", "category", 0),
        type: "category",
        table: "categorias",
        columns: ["nombre", "descripcion", "estado", "creado_en", "actualizado_en"],
        values: [
          "Vestidos de fiesta",
          "Prendas para eventos especiales, con distintos cortes y acabados.",
          "ACTIVO",
          timestampFor(options.referenceTime),
          timestampFor(options.referenceTime),
        ],
      });
  for (let index = 0; index < count; index += 1) {
    const [productName, productDescription] = productFixture(seed, index);
    const product = await insertTracked(connection, {
      key: seedKey(seed, "products", "product", index),
      type: "product",
      table: "productos",
      columns: ["categoria_id", "nombre", "descripcion", "estado", "creado_en", "actualizado_en"],
      values: [
        category.id,
        productName,
        productDescription,
        "ACTIVO",
        timestampFor(options.referenceTime),
        timestampFor(options.referenceTime),
      ],
    });
    await insertTracked(connection, {
      key: seedKey(seed, "products", "variant", index),
      type: "variant",
      table: "variantes",
      columns: [
        "producto_id", "sku", "talla", "color", "precio", "estado", "creado_en", "actualizado_en",
      ],
      values: [
        product.id,
        `VST-${seed}-${String(index + 1).padStart(3, "0")}`,
        ["S", "M", "L", "XL"][Math.floor(random() * 4)],
        ["Marfil", "Rosa", "Azul"][Math.floor(random() * 3)],
        (100 + index * 25).toFixed(2),
        "ACTIVO",
        timestampFor(options.referenceTime),
        timestampFor(options.referenceTime),
      ],
    });
  }
}

async function seedInventory(connection, options) {
  const { seed, count } = options;
  const variants = await variantsForSeed(seed, count, options);
  const random = createRng(seed);
  const quantities = Array.from(
    { length: count },
    () => 5 + Math.floor(random() * 8),
  );
  if (await findTracked(connection, seedKey(seed, "inventory", "supplier", 0)) === null) {
    const collision = await connection.query(
      "SELECT id FROM proveedores WHERE correo = ? LIMIT 1",
      [`proveedor.${seed}@example.invalid`],
    );
    if (collision.length) {
      throw new Error("El correo reservado para el proveedor ya está ocupado; no se modificará el registro existente.");
    }
  }
  const supplier = await insertTracked(connection, {
    key: seedKey(seed, "inventory", "supplier", 0),
    type: "supplier",
    table: "proveedores",
    columns: ["nombre", "correo", "estado", "creado_en", "actualizado_en"],
    values: [
      supplierFixture(seed),
      `ventas.${seed}@example.invalid`,
      "ACTIVO",
      timestampFor(options.referenceTime, 10),
      timestampFor(options.referenceTime, 10),
    ],
  });
  for (let index = 0; index < count; index += 1) {
    const quantity = quantities[index];
    const purchase = await insertTracked(connection, {
      key: seedKey(seed, "inventory", "purchase", index),
      type: "purchase",
      table: "compras",
      columns: [
        "proveedor_id", "fecha_compra", "estado", "total", "creado_en", "actualizado_en",
      ],
      values: [
        supplier.id,
        timestampFor(options.referenceTime, 10),
        "REGISTRADA",
        (quantity * 40).toFixed(2),
        timestampFor(options.referenceTime, 10),
        timestampFor(options.referenceTime, 10),
      ],
    });
    await insertTracked(connection, {
      key: seedKey(seed, "inventory", "purchase_detail", index),
      type: "purchase_detail",
      table: "detalle_compras",
      columns: [
        "compra_id", "variante_producto_id", "cantidad", "costo_unitario", "subtotal",
      ],
      values: [purchase.id, variants[index], quantity, "40.00", (quantity * 40).toFixed(2)],
    });
    const trackedStock = await findTracked(connection, seedKey(seed, "inventory", "stock", index));
    if (trackedStock === null) {
      const existing = await connection.query(
        "SELECT id FROM existencias WHERE variante_producto_id = ? LIMIT 1",
        [variants[index]],
      );
      if (existing.length) {
        throw new Error("La variante ya tiene una existencia no creada por este seed; no se modificará.");
      }
      await insertTracked(connection, {
        key: seedKey(seed, "inventory", "stock", index),
        type: "stock",
        table: "existencias",
        columns: ["variante_producto_id", "cantidad", "cantidad_minima", "actualizado_en"],
        values: [variants[index], quantity, 2, timestampFor(options.referenceTime, 10)],
      });
    } else {
      const stock = await connection.query(
        "SELECT id, variante_producto_id FROM existencias WHERE id = ?",
        [trackedStock],
      );
      if (!stock.length || String(stock[0].variante_producto_id) !== String(variants[index])) {
        throw new Error("La existencia registrada por el seed ya no coincide con su variante.");
      }
    }
    await insertTracked(connection, {
      key: seedKey(seed, "inventory", "movement", index),
      type: "movement",
      table: "movimientos_inventario",
      columns: [
        "variante_producto_id", "tipo_movimiento", "cantidad", "referencia_tipo",
        "referencia_id", "motivo", "idempotency_key", "creado_en",
      ],
      values: [
        variants[index],
        "ENTRADA",
        quantity,
        "COMPRA",
        purchase.id,
        "Ingreso de mercadería según compra a proveedor.",
        `demo-seed:${seed}:purchase:${index}`,
        timestampFor(options.referenceTime, 10),
      ],
    });
  }
}

function buildSaleFixtures(seed, variants) {
  const random = createRng(seed);
  return variants.map((variantId, index) => {
    const unitPrice = 100 + index * 25;
    const quantity = 1 + Math.floor(random() * 2);
    return {
      index,
      variantId,
      unitPrice,
      quantity,
      amount: (unitPrice * quantity).toFixed(2),
    };
  });
}

async function createSales(connection, options, fixtures) {
  const { seed } = options;
  const sales = [];
  await connection.beginTransaction();
  try {
    for (const fixture of fixtures) {
      const { index, variantId, quantity, unitPrice, amount } = fixture;
      const person = customerFixture(seed, index);
      const email = `${person.emailName}.${seed}.${index + 1}@example.invalid`;
      if (await findTracked(connection, seedKey(seed, "sales", "client", index)) === null) {
        const collision = await connection.query(
          "SELECT id FROM clientes WHERE correo = ? LIMIT 1",
          [email],
        );
        if (collision.length) {
          throw new Error("Un correo reservado para el seed ya está ocupado; no se modificará el cliente existente.");
        }
      }
      const client = await insertTracked(connection, {
        key: seedKey(seed, "sales", "client", index),
        type: "client",
        table: "clientes",
        columns: [
          "nombre", "apellido_paterno", "apellido_materno", "apellido", "correo",
          "estado", "creado_en", "actualizado_en",
        ],
        values: [
          person.nombre,
          person.apellidoPaterno,
          person.apellidoMaterno,
          person.apellido,
          email,
          "ACTIVO",
          timestampFor(options.referenceTime, 5),
          timestampFor(options.referenceTime, 5),
        ],
      });
      const sale = await insertTracked(connection, {
        key: seedKey(seed, "sales", "sale", index),
        type: "sale",
        table: "ventas",
        columns: [
          "cliente_id", "fecha_venta", "estado", "subtotal", "total",
          "creado_en", "actualizado_en",
        ],
        values: [
          client.id,
          timestampFor(options.referenceTime, 5),
          "PENDIENTE",
          amount,
          amount,
          timestampFor(options.referenceTime, 5),
          timestampFor(options.referenceTime, 5),
        ],
      });
      const detail = await insertTracked(connection, {
        key: seedKey(seed, "sales", "sale_detail", index),
        type: "sale_detail",
        table: "detalle_ventas",
        columns: [
          "venta_id", "variante_producto_id", "cantidad", "precio_unitario", "subtotal",
        ],
        values: [sale.id, variantId, quantity, unitPrice.toFixed(2), amount],
      });
      const storedDetail = await connection.query(
        "SELECT variante_producto_id, cantidad, precio_unitario, subtotal FROM detalle_ventas WHERE id = ?",
        [detail.id],
      );
      if (
        !storedDetail.length ||
        String(storedDetail[0].variante_producto_id) !== String(variantId) ||
        Number(storedDetail[0].cantidad) !== quantity ||
        Number(storedDetail[0].precio_unitario) !== unitPrice ||
        Number(storedDetail[0].subtotal) !== Number(amount)
      ) {
        throw new Error("El detalle de venta registrado no coincide con los datos del seed.");
      }
      const storedSale = await connection.query(
        "SELECT cliente_id, subtotal, total, estado FROM ventas WHERE id = ?",
        [sale.id],
      );
      if (
        !storedSale.length ||
        !["PENDIENTE", "CONFIRMADA"].includes(storedSale[0].estado) ||
        String(storedSale[0].cliente_id) !== String(client.id) ||
        Number(storedSale[0].subtotal) !== Number(amount) ||
        Number(storedSale[0].total) !== Number(amount)
      ) {
        throw new Error("La venta de demostración tiene un estado incompatible; no se sobrescribirá.");
      }
      sales.push({
        index,
        id: sale.id,
        variantId,
        quantity,
        amount,
        state: storedSale[0].estado,
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return sales;
}

async function applySaleMovement(connection, options, sale) {
  const { seed } = options;
  const stockKey = seedKey(seed, "inventory", "stock", sale.index);
  const key = seedKey(seed, "inventory", "sale_movement", sale.index);
  const idempotencyKey = `demo-seed:sale:${seed}:${sale.index}`;
  await connection.beginTransaction();
  try {
    const existing = await findTracked(connection, key);
    if (existing !== null) {
      const movement = await connection.query(
        "SELECT id, variante_producto_id, cantidad, referencia_tipo, referencia_id, idempotency_key FROM movimientos_inventario WHERE id = ?",
        [existing],
      );
      if (
        !movement.length ||
        String(movement[0].variante_producto_id) !== String(sale.variantId) ||
        Number(movement[0].cantidad) !== sale.quantity ||
        movement[0].referencia_tipo !== "VENTA" ||
        String(movement[0].referencia_id) !== String(sale.id) ||
        movement[0].idempotency_key !== idempotencyKey
      ) {
        throw new Error("El movimiento de venta registrado no coincide con los datos actuales.");
      }
      await connection.commit();
      return;
    }
    if (sale.state === "CONFIRMADA") {
      throw new Error("Una venta confirmada sin su movimiento registrado requiere conciliación manual.");
    }
    const priorMovement = await connection.query(
      "SELECT id FROM movimientos_inventario WHERE idempotency_key = ? LIMIT 1",
      [idempotencyKey],
    );
    if (priorMovement.length) {
      throw new Error("La clave del movimiento de venta ya existe sin propiedad registrada.");
    }
    const stockId = await findTracked(connection, stockKey);
    if (stockId === null) {
      throw new Error("La venta requiere existencias creadas por el mismo seed.");
    }
    const stock = await connection.query(
      "SELECT id, cantidad FROM existencias WHERE id = ? AND variante_producto_id = ?",
      [stockId, sale.variantId],
    );
    if (!stock.length || Number(stock[0].cantidad) < sale.quantity) {
      throw new Error("No hay existencias propias suficientes para confirmar la venta de prueba.");
    }
    const updated = await connection.query(
      "UPDATE existencias SET cantidad = cantidad - ?, actualizado_en = ? WHERE id = ? AND cantidad >= ?",
      [sale.quantity, timestampFor(options.referenceTime, 4), stockId, sale.quantity],
    );
    if (Number(updated.affectedRows) !== 1) {
      throw new Error("No se pudo descontar el stock de demostración de forma segura.");
    }
    await insertTracked(connection, {
      key,
      type: "sale_movement",
      table: "movimientos_inventario",
      columns: [
        "variante_producto_id", "tipo_movimiento", "cantidad", "referencia_tipo",
        "referencia_id", "motivo", "idempotency_key", "creado_en",
      ],
      values: [
        sale.variantId,
        "SALIDA",
        sale.quantity,
        "VENTA",
        sale.id,
        `Salida de venta sintética ${sale.id}.`,
        idempotencyKey,
        timestampFor(options.referenceTime, 4),
      ],
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function confirmSales(connection, options, sales) {
  await connection.beginTransaction();
  try {
    for (const sale of sales) {
      await connection.query(
        "UPDATE ventas SET estado = 'CONFIRMADA', actualizado_en = ? WHERE id = ? AND estado = 'PENDIENTE'",
        [timestampFor(options.referenceTime, 4), sale.id],
      );
      const storedSale = await connection.query(
        "SELECT estado FROM ventas WHERE id = ?",
        [sale.id],
      );
      if (storedSale[0]?.estado !== "CONFIRMADA") {
        throw new Error("No se pudo confirmar la venta después del movimiento de stock.");
      }
      const paymentKey = seedKey(options.seed, "sales", "payment", sale.index);
      const payment = await insertTracked(connection, {
        key: paymentKey,
        type: "payment",
        table: "pagos",
        columns: [
          "venta_id", "metodo_pago", "monto", "estado", "fecha_pago",
          "creado_en", "actualizado_en",
        ],
        values: [
          sale.id,
          "EFECTIVO",
          sale.amount,
          "PAGADO",
          timestampFor(options.referenceTime, 4),
          timestampFor(options.referenceTime, 4),
          timestampFor(options.referenceTime, 4),
        ],
      });
      const storedPayment = await connection.query(
        "SELECT venta_id, monto, estado FROM pagos WHERE id = ?",
        [payment.id],
      );
      if (
        !storedPayment.length ||
        String(storedPayment[0].venta_id) !== String(sale.id) ||
        Number(storedPayment[0].monto) !== Number(sale.amount) ||
        storedPayment[0].estado !== "PAGADO"
      ) {
        throw new Error("El pago registrado no coincide con la venta del seed.");
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function seedSales(connection, options) {
  const variants = await variantsForSeed(options.seed, options.count, options);
  const fixtures = buildSaleFixtures(options.seed, variants);
  const inventory = await openDatabase("inventory", options);
  try {
    await ensureRegistry(inventory);
    for (const fixture of fixtures) {
      const movementKey = seedKey(options.seed, "inventory", "sale_movement", fixture.index);
      if (await findTracked(inventory, movementKey)) continue;
      const stockId = await findTracked(
        inventory,
        seedKey(options.seed, "inventory", "stock", fixture.index),
      );
      if (stockId === null) {
        throw new Error("Ejecute primero inventario con el mismo seed antes de cargar ventas.");
      }
      const stock = await inventory.query(
        "SELECT cantidad FROM existencias WHERE id = ? AND variante_producto_id = ?",
        [stockId, fixture.variantId],
      );
      if (!stock.length || Number(stock[0].cantidad) < fixture.quantity) {
        throw new Error("No hay existencias propias suficientes para el conjunto de ventas solicitado.");
      }
    }
    const sales = await createSales(connection, options, fixtures);
    for (const sale of sales) {
      await applySaleMovement(inventory, options, sale);
    }
    await confirmSales(connection, options, sales);
  } finally {
    await inventory.end();
  }
}

function openEventDatabase(dataDir, initialize = true) {
  const resolvedDir = path.resolve(dataDir);
  const folderNames = resolvedDir.split(path.sep);
  const projectRelative = path.relative(ROOT, resolvedDir);
  const isInsideProject =
    projectRelative === "" ||
    (!projectRelative.startsWith(`..${path.sep}`) &&
      projectRelative !== ".." &&
      !path.isAbsolute(projectRelative));
  if (
    isInsideProject ||
    !folderNames.some((part) => /(demo|test|integration)/i.test(part))
  ) {
    throw new Error("DEMO_CORRELATION_DATA_DIR debe estar fuera del repositorio y en una carpeta aislada demo/test/integration.");
  }
  if (!initialize && !fs.existsSync(path.join(resolvedDir, "correlation.sqlite"))) {
    return null;
  }
  for (const legacyFile of ["events.jsonl", "analyses.jsonl"]) {
    if (fs.existsSync(path.join(resolvedDir, legacyFile))) {
      throw new Error("No se importarán archivos JSONL existentes; use un directorio de correlación de prueba dedicado.");
    }
  }
  if (initialize) fs.mkdirSync(resolvedDir, { recursive: true });
  const database = new (require("node:sqlite").DatabaseSync)(
    path.join(resolvedDir, "correlation.sqlite"),
  );
  if (!initialize) {
    const registry = database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'demo_seed_registry'",
    ).get();
    if (!registry) {
      database.close();
      return null;
    }
    return database;
  }
  initializeEventSchema(database);
  return database;
}

function initializeEventSchema(database) {
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      service TEXT NOT NULL,
      usuario_id INTEGER,
      tipo_evento TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidad_id TEXT,
      timestamp TEXT NOT NULL,
      resultado TEXT NOT NULL CHECK (resultado IN ('EXITOSO', 'FALLIDO')),
      metadata_json TEXT NOT NULL,
      event_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analyses (
      analysis_id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      usuario_id INTEGER,
      analysis_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS demo_seed_registry (
      seed_key TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL
    );
  `);
}

function persistEvents(database, seed, events) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const event of events) {
      const key = seedKey(seed, "events", "event", event.event_id);
      const existing = database.prepare(
        "SELECT entity_id FROM demo_seed_registry WHERE seed_key = ?",
      ).get(key);
      if (existing) {
        const registered = database.prepare(
          "SELECT event_json FROM events WHERE event_id = ?",
        ).get(event.event_id);
        if (!registered || registered.event_json !== JSON.stringify(event)) {
          throw new Error("Un evento registrado ya existe con contenido diferente.");
        }
        continue;
      }
      const collision = database.prepare(
        "SELECT event_id FROM events WHERE event_id = ?",
      ).get(event.event_id);
      if (collision) {
        throw new Error("Un evento con el ID reservado ya existe y no pertenece a este seed.");
      }
      database.prepare(`
        INSERT INTO events (
          event_id, service, usuario_id, tipo_evento, entidad, entidad_id,
          timestamp, resultado, metadata_json, event_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.event_id,
        event.service,
        event.usuario_id,
        event.tipo_evento,
        event.entidad,
        event.entidad_id,
        event.timestamp,
        event.resultado,
        JSON.stringify(event.metadata),
        JSON.stringify(event),
      );
      database.prepare(
        "INSERT INTO demo_seed_registry (seed_key, entity_type, entity_id) VALUES (?, ?, ?)",
      ).run(key, "event", event.event_id);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function removeSeedEvents(database, seed) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const rows = database.prepare(
      "SELECT entity_id FROM demo_seed_registry WHERE seed_key LIKE ?",
    ).all(`${prefixFor(seed, "events")}%`);
    const hasAnalyses = database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'analyses'",
    ).get();
    for (const row of rows) {
      if (hasAnalyses) {
        const analysis = database.prepare(
          "SELECT analysis_id FROM analyses WHERE instr(analysis_json, ?) > 0 LIMIT 1",
        ).get(String(row.entity_id));
        if (analysis) {
          throw new Error("Se conservarán eventos incluidos en análisis persistidos.");
        }
      }
      database.prepare("DELETE FROM events WHERE event_id = ?").run(String(row.entity_id));
    }
    database.prepare(
      "DELETE FROM demo_seed_registry WHERE seed_key LIKE ?",
    ).run(`${prefixFor(seed, "events")}%`);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function seedEvents(options) {
  const users = await usersForSeed(options.seed, options);
  const sales = await salesForSeed(
    options.seed,
    Math.max(options.count, options.scenario === "normal" ? 1 : 3),
    options,
  );
  const variants = await variantsForSeed(options.seed, Math.max(options.count, 1), options);
  const events = buildScenarioEvents({
    seed: options.eventSeed,
    scenario: options.scenario,
    referenceTime: options.referenceTime,
    users,
    saleIds: sales,
    variantIds: variants,
  });
  if (options.allowOperational) {
    fs.writeFileSync(options.eventsOutput, JSON.stringify(events, null, 2), { flag: "wx" });
    process.stdout.write(`Generados ${events.length} eventos sintéticos para entrega por el servicio real.\n`);
    return;
  }
  const dataDir = process.env.DEMO_CORRELATION_DATA_DIR;
  if (!dataDir) {
    throw new Error("Defina DEMO_CORRELATION_DATA_DIR con un directorio SQLite aislado para datos de prueba.");
  }
  const database = openEventDatabase(dataDir, true);

  try {
    persistEvents(database, options.eventSeed, events);
  } finally {
    database.close();
  }
}

const DELETE_ORDER = {
  users: ["user_role", "user", "role"],
  products: ["variant", "product", "category"],
  inventory: ["sale_movement", "movement", "stock", "purchase_detail", "purchase", "supplier"],
  sales: ["sale_detail", "payment", "sale", "client"],
};

const DELETE_SQL = {
  users: {
    user_role: async (connection, id) => {
      const [userId, roleId] = id.split(":");
      await connection.query("DELETE FROM usuario_rol WHERE usuario_id = ? AND rol_id = ?", [userId, roleId]);
    },
    user: async (connection, id) => {
      const rows = await connection.query(
        "SELECT estado FROM usuarios WHERE id = ?",
        [id],
      );
      if (rows[0] && rows[0].estado !== "INACTIVO") {
        throw new Error("Se conservará un usuario de demostración que ya no esté inactivo.");
      }
      const related = await connection.query(
        "SELECT (SELECT COUNT(*) FROM credenciales WHERE usuario_id = ?) + (SELECT COUNT(*) FROM empleados WHERE usuario_id = ?) + (SELECT COUNT(*) FROM tokens_refresh WHERE usuario_id = ?) + (SELECT COUNT(*) FROM tokens_recuperacion WHERE usuario_id = ?) + (SELECT COUNT(*) FROM tokens_verificacion WHERE usuario_id = ?) AS count",
        [id, id, id, id, id],
      );
      if (Number(related[0]?.count || 0) > 0) {
        throw new Error("Se conservará el usuario porque tiene relaciones de autenticación o empleo.");
      }
      await connection.query("DELETE FROM usuarios WHERE id = ?", [id]);
    },
    role: async (connection, id) => {
      const rows = await connection.query(
        "SELECT (SELECT COUNT(*) FROM usuario_rol WHERE rol_id = ?) + (SELECT COUNT(*) FROM rol_permiso WHERE rol_id = ?) AS count",
        [id, id],
      );
      if (Number(rows[0]?.count || 0) > 0) {
        throw new Error("Se conservará el rol porque aún tiene relaciones.");
      }
      await connection.query("DELETE FROM roles WHERE id = ?", [id]);
    },
  },
  products: {
    variant: async (connection, id) => {
      const references = [];
      for (const service of ["inventory", "sales"]) {
        const external = await openDatabase(service);
        try {
          const tables = service === "inventory"
            ? ["existencias", "detalle_compras", "movimientos_inventario"]
            : ["detalle_ventas"];
          for (const table of tables) {
            const rows = await external.query(
              `SELECT COUNT(*) AS count FROM \`${table}\` WHERE variante_producto_id = ?`,
              [id],
            );
            references.push(Number(rows[0]?.count || 0));
          }
        } finally {
          await external.end();
        }
      }
      if (references.some((count) => count > 0)) {
        throw new Error("Se conservará la variante porque aún aparece referenciada en inventario o ventas.");
      }
      await connection.query("DELETE FROM variantes WHERE id = ?", [id]);
    },
    product: async (connection, id) => {
      await connection.query("DELETE FROM productos WHERE id = ?", [id]);
    },
    category: async (connection, id) => {
      await connection.query("DELETE FROM categorias WHERE id = ?", [id]);
    },
  },
  inventory: {
    sale_movement: async (connection, id) => connection.query("DELETE FROM movimientos_inventario WHERE id = ?", [id]),
    movement: async (connection, id) => connection.query("DELETE FROM movimientos_inventario WHERE id = ?", [id]),
    stock: async (connection, id) => connection.query("DELETE FROM existencias WHERE id = ?", [id]),
    purchase_detail: async (connection, id) => connection.query("DELETE FROM detalle_compras WHERE id = ?", [id]),
    purchase: async (connection, id) => connection.query("DELETE FROM compras WHERE id = ?", [id]),
    supplier: async (connection, id) => connection.query("DELETE FROM proveedores WHERE id = ?", [id]),
  },
  sales: {
    sale_detail: async (connection, id) => connection.query("DELETE FROM detalle_ventas WHERE id = ?", [id]),
    payment: async (connection, id) => connection.query("DELETE FROM pagos WHERE id = ?", [id]),
    sale: async (connection, id) => {
      const protectedRelations = await connection.query(
        "SELECT (SELECT COUNT(*) FROM operaciones_anulacion WHERE venta_id = ?) + (SELECT COUNT(*) FROM eventos_anulacion e JOIN operaciones_anulacion o ON o.id = e.operacion_id WHERE o.venta_id = ?) AS count",
        [id, id],
      );
      if (Number(protectedRelations[0]?.count || 0) > 0) {
        throw new Error("Se conservará una venta con historial de anulación.");
      }
      await connection.query("DELETE FROM ventas WHERE id = ?", [id]);
    },
    client: async (connection, id) => {
      const rows = await connection.query("SELECT COUNT(*) AS count FROM ventas WHERE cliente_id = ?", [id]);
      if (Number(rows[0]?.count || 0) > 0) {
        throw new Error("Se conservará el cliente porque todavía tiene ventas relacionadas.");
      }
      await connection.query("DELETE FROM clientes WHERE id = ?", [id]);
    },
  },
};

async function cleanupDatabase(service, options) {
  const connection = await openDatabase(service, options);
  try {
    const registry = await connection.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_demo_seed_registry'",
    );
    if (!registry.length) return;
    await connection.beginTransaction();
    try {
      const rows = await recordsFor(connection, options.seed, service);
      for (const type of DELETE_ORDER[service]) {
        for (const row of rows.filter((entry) => entry.entity_type === type)) {
          await DELETE_SQL[service][type](connection, String(row.entity_id));
        }
      }
      await connection.query(
        "DELETE FROM _demo_seed_registry WHERE seed_key LIKE ?",
        [`${prefixFor(options.seed, service)}%`],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

async function cleanupEvents(options) {
  const dataDir = process.env.DEMO_CORRELATION_DATA_DIR;
  if (!dataDir) {
    throw new Error("Defina DEMO_CORRELATION_DATA_DIR para limpiar únicamente los eventos registrados por el seed.");
  }
  const database = openEventDatabase(dataDir, false);
  if (!database) return;
  try {
    removeSeedEvents(database, options.eventSeed);
  } finally {
    database.close();
  }
}

async function runDatabaseService(service, options) {
  const connection = await openDatabase(service, options);
  try {
    await ensureRegistry(connection);
    if (service === "sales") {
      await seedSales(connection, options);
      return;
    }
    await connection.beginTransaction();
    try {
      if (service === "users") await seedUsers(connection, options);
      if (service === "products") await seedProducts(connection, options);
      if (service === "inventory") await seedInventory(connection, options);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

function requireApplyConfirmation(options) {
  if (!options.apply) return;
  if (options.allowOperational) {
    if (process.env.DEMO_OPERATIONAL_SEED_CONFIRM !== OPERATIONAL_CONFIRMATION) {
      throw new Error(
        `Para escribir en las bases operativas, defina DEMO_OPERATIONAL_SEED_CONFIRM=${OPERATIONAL_CONFIRMATION}.`,
      );
    }
    return;
  }
  if (process.env.DEMO_SEED_CONFIRM !== CONFIRMATION) {
    throw new Error(`Para escribir, defina DEMO_SEED_CONFIRM=${CONFIRMATION} después de verificar bases aisladas.`);
  }
}

function sanitizedErrorMessage(error) {
  let message = error instanceof Error ? error.message : "Error inesperado.";
  for (const [name, rawUrl] of Object.entries(process.env)) {
    if (
      !/^(DEMO_(USERS|PRODUCTS|INVENTORY|SALES)_DATABASE_URL|(USERS|PRODUCTS|INVENTORY|SALES)_SERVICE_DATABASE_URL)$/.test(name) ||
      !rawUrl
    ) continue;
    message = message.split(rawUrl).join("[URL de conexión oculta]");
    try {
      const url = new URL(rawUrl);
      for (const part of [url.username, url.password]) {
        if (!part) continue;
        const decoded = decodeURIComponent(part);
        message = message.split(part).join("[dato de conexión oculto]");
        message = message.split(decoded).join("[dato de conexión oculto]");
      }
    } catch {
      message = message.split(rawUrl).join("[URL de conexión oculta]");
    }
  }
  return message;
}

function planMessage(options) {
  const selected = options.service === "all" ? SERVICES : [options.service];
  const actions = options.cleanup
    ? `limpiar exclusivamente registros registrados por este script para seed ${options.seed}`
    : `crear hasta ${options.count} registros de demostración por servicio, con seed ${options.seed}`;
  const target = options.allowOperational
    ? "Destinos: bases operativas locales exactas; requiere confirmación operativa y no permite limpieza."
    : "Destinos: bases aisladas _demo/_test/_integration.";
  return [
    `Vista previa: ${actions}.`,
    `Servicios seleccionados: ${selected.join(", ")}.`,
    `Escenario de eventos: ${options.scenario}.`,
    `Semilla de referencias: ${options.seed}; semilla de IDs de eventos: ${options.eventSeed}.`,
    target,
    "No se accedió a ninguna base de datos ni se escribió ningún archivo.",
    options.allowOperational
      ? "Para ejecutar, agregue --apply, --allow-operational y confirme explícitamente los destinos."
      : "Para ejecutar, agregue --apply y confirme destinos _demo/_test/_integration.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.apply) {
    process.stdout.write(`${planMessage(options)}\n`);
    return;
  }
  requireApplyConfirmation(options);
  const selected = options.service === "all" ? SERVICES : [options.service];
  if (options.cleanup) {
    const order = ["sales", "inventory", "products", "users", "events"];
    for (const service of order.filter((item) => selected.includes(item))) {
      if (service === "events") await cleanupEvents(options);
      else await cleanupDatabase(service, options);
    }
    process.stdout.write(`Limpieza completada para seed ${options.seed}; los registros sin propiedad demostrable se conservaron.\n`);
    return;
  }
  for (const service of selected) {
    if (service === "events") {
      await seedEvents(options);
    } else {
      await runDatabaseService(service, options);
    }
  }
  process.stdout.write(`Carga completada para seed ${options.seed}. Eventos/análisis sintéticos no son resultados operativos ni evidencia de validación académica.\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Error: ${sanitizedErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BASE_TIME,
  buildSaleFixtures,
  buildEvents,
  buildScenarioEvents,
  createRng,
  customerFixture,
  productFixture,
  staffFixture,
  supplierFixture,
  initializeEventSchema,
  parseArgs,
  parseDatabaseUrl,
  requireApplyConfirmation,
  persistEvents,
  removeSeedEvents,
  safeDatabaseName,
  sanitizedErrorMessage,
  seedKey,
};
