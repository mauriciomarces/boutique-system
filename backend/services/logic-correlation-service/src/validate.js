const { EVENT_TYPES, REQUIRED_EVENT_FIELDS } = require("./constants");

const ALLOWED_TYPES = new Set(Object.values(EVENT_TYPES));
const ALLOWED_RESULTS = new Set(["EXITOSO", "FALLIDO"]);

function validateEvent(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "El cuerpo debe ser un objeto de evento." };
  }

  for (const field of REQUIRED_EVENT_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      return { ok: false, error: `Campo obligatorio ausente: ${field}` };
    }
  }

  if (!ALLOWED_TYPES.has(payload.tipo_evento)) {
    return {
      ok: false,
      error: `tipo_evento no reconocido: ${payload.tipo_evento}`,
    };
  }

  if (!ALLOWED_RESULTS.has(payload.resultado)) {
    return { ok: false, error: "resultado debe ser EXITOSO o FALLIDO." };
  }

  const timestamp = Date.parse(payload.timestamp);
  if (Number.isNaN(timestamp)) {
    return { ok: false, error: "timestamp inválido." };
  }

  const usuarioId = Number(payload.usuario_id);
  if (!Number.isInteger(usuarioId) || usuarioId < 0) {
    return { ok: false, error: "usuario_id debe ser un entero." };
  }

  const sanitized = {
    event_id: String(payload.event_id),
    service: payload.service ? String(payload.service) : undefined,
    usuario_id: usuarioId,
    tipo_evento: payload.tipo_evento,
    entidad: String(payload.entidad),
    entidad_id:
      payload.entidad_id === undefined || payload.entidad_id === null
        ? null
        : payload.entidad_id,
    timestamp: new Date(timestamp).toISOString(),
    resultado: payload.resultado,
    ip: payload.ip ? String(payload.ip) : undefined,
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? stripSensitive(payload.metadata)
        : {},
  };

  return { ok: true, event: sanitized };
}

function stripSensitive(metadata) {
  const blocked = new Set([
    "password",
    "contrasena",
    "token",
    "correo",
    "email",
    "telefono",
    "nombre",
    "apellido",
    "ci",
    "documento",
  ]);
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

module.exports = { validateEvent };
