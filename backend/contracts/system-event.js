const schema = require("./system-event.schema.json");

const REQUIRED_FIELDS = new Set(schema.required);
const ALLOWED_FIELDS = new Set(Object.keys(schema.properties));
const SENSITIVE_METADATA_KEY =
  /(password|contrasena|hash|token|secret|correo|email|telefono|nombre|apellido|documento|authorization)/i;
const METADATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function validateSystemEvent(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "El cuerpo debe ser un objeto de evento." };
  }
  const unknownField = Object.keys(payload).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknownField) {
    return { ok: false, error: `Campo no reconocido en el evento: ${unknownField}` };
  }
  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      return { ok: false, error: `Campo obligatorio ausente: ${field}` };
    }
  }

  if (
    typeof payload.event_id !== "string" ||
    payload.event_id.length < 1 ||
    payload.event_id.length > 120
  ) {
    return { ok: false, error: "event_id debe ser texto de hasta 120 caracteres." };
  }
  if (
    typeof payload.service !== "string" ||
    payload.service.length < 1 ||
    payload.service.length > 80 ||
    !schema.properties.service.enum.includes(payload.service)
  ) {
    return { ok: false, error: "service no es un servicio emisor reconocido." };
  }
  if (!schema.properties.tipo_evento.enum.includes(payload.tipo_evento)) {
    return { ok: false, error: `tipo_evento no reconocido: ${payload.tipo_evento}` };
  }
  if (
    typeof payload.entidad !== "string" ||
    payload.entidad.length < 1 ||
    payload.entidad.length > 80
  ) {
    return { ok: false, error: "entidad debe ser texto de hasta 80 caracteres." };
  }
  if (!schema.properties.resultado.enum.includes(payload.resultado)) {
    return { ok: false, error: "resultado debe ser EXITOSO o FALLIDO." };
  }
  if (
    payload.usuario_id !== undefined &&
    payload.usuario_id !== null &&
    (typeof payload.usuario_id !== "number" ||
      !Number.isSafeInteger(payload.usuario_id) ||
      payload.usuario_id < 0)
  ) {
    return { ok: false, error: "usuario_id debe ser un entero no negativo o null." };
  }

  const timestamp = typeof payload.timestamp === "string"
    ? Date.parse(payload.timestamp)
    : Number.NaN;
  if (Number.isNaN(timestamp) || !TIMESTAMP_PATTERN.test(payload.timestamp)) {
    return { ok: false, error: "timestamp inválido." };
  }
  if (
    payload.entidad_id !== undefined &&
    payload.entidad_id !== null &&
    !(
      (typeof payload.entidad_id === "string" && payload.entidad_id.length <= 120) ||
      (typeof payload.entidad_id === "number" &&
        Number.isSafeInteger(payload.entidad_id) &&
        Math.abs(payload.entidad_id) <= 9007199254740991)
    )
  ) {
    return { ok: false, error: "entidad_id debe ser texto, entero seguro o null." };
  }
  if (payload.ip !== undefined && (typeof payload.ip !== "string" || payload.ip.length > 64)) {
    return { ok: false, error: "ip debe ser texto de hasta 64 caracteres." };
  }

  const metadata = payload.metadata === undefined ? {} : payload.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    Object.keys(metadata).length > 20
  ) {
    return { ok: false, error: "metadata debe ser un objeto de hasta 20 propiedades." };
  }

  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEY.test(key)) continue;
    if (!METADATA_KEY_PATTERN.test(key)) {
      return { ok: false, error: `Nombre de propiedad metadata inválido: ${key}` };
    }
    if (
      !["string", "number", "boolean"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value)) ||
      (typeof value === "string" && value.length > 200)
    ) {
      return { ok: false, error: `Valor metadata no permitido: ${key}` };
    }
    cleanMetadata[key] = value;
  }

  return {
    ok: true,
    event: {
      event_id: payload.event_id,
      service: payload.service,
      usuario_id: payload.usuario_id ?? null,
      tipo_evento: payload.tipo_evento,
      entidad: payload.entidad,
      entidad_id: payload.entidad_id ?? null,
      timestamp: new Date(timestamp).toISOString(),
      resultado: payload.resultado,
      ...(payload.ip === undefined ? {} : { ip: payload.ip }),
      metadata: cleanMetadata,
    },
  };
}

module.exports = { validateSystemEvent };
