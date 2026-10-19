const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { isDeepStrictEqual } = require("node:util");

const dataDir = process.env.CORRELATION_DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const database = new DatabaseSync(path.join(dataDir, "correlation.sqlite"));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
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
  CREATE INDEX IF NOT EXISTS events_usuario_timestamp ON events(usuario_id, timestamp);
  CREATE INDEX IF NOT EXISTS events_service_timestamp ON events(service, timestamp);
  CREATE INDEX IF NOT EXISTS events_type_timestamp ON events(tipo_evento, timestamp);
  CREATE TABLE IF NOT EXISTS analyses (
    analysis_id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    usuario_id INTEGER,
    analysis_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS analyses_usuario_generated ON analyses(usuario_id, generated_at);
  CREATE TABLE IF NOT EXISTS store_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function eventFromRow(row) {
  return JSON.parse(row.event_json);
}

function insertEvent(event) {
  const result = database.prepare(`
    INSERT OR IGNORE INTO events (
      event_id, service, usuario_id, tipo_evento, entidad, entidad_id,
      timestamp, resultado, metadata_json, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.event_id,
    event.service,
    event.usuario_id ?? null,
    event.tipo_evento,
    event.entidad,
    event.entidad_id == null ? null : String(event.entidad_id),
    event.timestamp,
    event.resultado,
    JSON.stringify(event.metadata ?? {}),
    JSON.stringify(event),
  );

  if (result.changes === 1) return { status: "created", event };
  const existingRow = database.prepare(
    "SELECT event_json FROM events WHERE event_id = ?",
  ).get(event.event_id);
  if (!existingRow) throw new Error("No se pudo confirmar la inserción del evento.");
  const existing = eventFromRow(existingRow);
  return {
    status: isDeepStrictEqual(existing, event) ? "duplicate" : "conflict",
    event: existing,
  };
}

function addEvent(event) {
  return insertEvent(event);
}

function addAnalysis(analysis) {
  const result = database.prepare(`
    INSERT OR IGNORE INTO analyses (analysis_id, generated_at, usuario_id, analysis_json)
    VALUES (?, ?, ?, ?)
  `).run(
    analysis.analysis_id,
    analysis.generated_at,
    analysis.usuario_id ?? null,
    JSON.stringify(analysis),
  );
  if (result.changes === 1) return analysis;

  const existingRow = database.prepare(
    "SELECT analysis_json FROM analyses WHERE analysis_id = ?",
  ).get(analysis.analysis_id);
  if (!existingRow) throw new Error("No se pudo confirmar la inserción del análisis.");
  const existing = JSON.parse(existingRow.analysis_json);
  if (!isDeepStrictEqual(existing, analysis)) {
    throw new Error("analysis_id ya existe con otro contenido.");
  }
  return existing;
}

function importLegacyJsonl(filename, insertRecord) {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`JSON inválido en ${filename}, línea ${index + 1}.`, { cause: error });
    }
    try {
      const result = insertRecord(record);
      if (result?.status === "conflict") {
        throw new Error(`Identificador duplicado con contenido distinto: ${record.event_id}.`);
      }
    } catch (error) {
      throw new Error(`No se pudo importar ${filename}, línea ${index + 1}.`, { cause: error });
    }
  }
}

function migrateLegacyFiles() {
  const migrationKey = "jsonl-to-sqlite-v1";
  if (database.prepare("SELECT 1 FROM store_metadata WHERE key = ?").get(migrationKey)) return;

  database.exec("BEGIN IMMEDIATE");
  try {
    importLegacyJsonl("events.jsonl", insertEvent);
    importLegacyJsonl("analyses.jsonl", addAnalysis);
    database.prepare("INSERT INTO store_metadata (key, value) VALUES (?, ?)").run(
      migrationKey,
      new Date().toISOString(),
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

migrateLegacyFiles();

function reset({ clearPersistence = false } = {}) {
  if (clearPersistence) {
    database.exec("DELETE FROM events; DELETE FROM analyses;");
  }
}

function listEvents({ usuario_id, service, tipo_evento, from, to, limit } = {}) {
  const conditions = [];
  const values = [];
  if (usuario_id !== undefined && usuario_id !== "") {
    if (usuario_id === null || usuario_id === "anonymous") {
      conditions.push("usuario_id IS NULL");
    } else {
      conditions.push("usuario_id = ?");
      values.push(Number(usuario_id));
    }
  }
  if (service) {
    conditions.push("service = ?");
    values.push(service);
  }
  if (tipo_evento) {
    conditions.push("tipo_evento = ?");
    values.push(tipo_evento);
  }
  if (from) {
    conditions.push("timestamp >= ?");
    values.push(new Date(from).toISOString());
  }
  if (to) {
    conditions.push("timestamp <= ?");
    values.push(new Date(to).toISOString());
  }

  let sql = "SELECT event_json FROM events";
  if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
  if (limit !== undefined && limit !== null && limit !== "") {
    const parsedLimit = Number(limit);
    if (Number.isInteger(parsedLimit) && parsedLimit >= 0) {
      if (parsedLimit === 0) return [];
      sql += " ORDER BY timestamp DESC, event_id DESC LIMIT ?";
      values.push(parsedLimit);
      return database.prepare(sql).all(...values).map(eventFromRow).reverse();
    }
  }
  sql += " ORDER BY timestamp ASC, event_id ASC";
  return database.prepare(sql).all(...values).map(eventFromRow);
}

function listAnalyses({ limit = 100 } = {}) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    throw new RangeError("limit debe ser un entero entre 1 y 500.");
  }
  return database.prepare(`
    SELECT analysis_json
    FROM analyses
    ORDER BY generated_at DESC, analysis_id DESC
    LIMIT ?
  `).all(parsedLimit).map((row) => JSON.parse(row.analysis_json));
}

function close() {
  database.close();
}

module.exports = {
  addEvent,
  addAnalysis,
  listEvents,
  listAnalyses,
  reset,
  close,
};
