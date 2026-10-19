const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { validateSystemEvent } = require("./system-event");

const service = process.env.SYSTEM_EVENT_SERVICE;
const correlationUrl = process.env.CORRELATION_SERVICE_URL ||
  (service ? "http://localhost:4007" : undefined);
const outboxPath = process.env.EVENT_OUTBOX_PATH ||
  (service ? path.join(__dirname, "..", "services", service, "data", "events-outbox.json") : undefined);
let warnedNotConfigured = false;
let flushing = false;

function readOutbox() {
  if (!outboxPath || !fs.existsSync(outboxPath)) return [];
  const raw = fs.readFileSync(outboxPath, "utf8");
  if (!raw.trim()) return [];
  const events = JSON.parse(raw);
  if (!Array.isArray(events)) throw new Error("El outbox de eventos no contiene una lista.");
  return events;
}

function writeOutbox(events) {
  if (!outboxPath) throw new Error("EVENT_OUTBOX_PATH no está configurado.");
  fs.mkdirSync(path.dirname(outboxPath), { recursive: true });
  const temporaryPath = `${outboxPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(events), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, outboxPath);
}

async function flushOutbox() {
  if (flushing || !correlationUrl || !outboxPath) return;
  flushing = true;
  try {
    let pending = readOutbox();
    while (pending.length) {
      const event = pending[0];
      try {
        const response = await fetch(`${correlationUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(3000),
        });
        if (response.status !== 201 && response.status !== 200) {
          console.error("No se confirmó la entrega de un evento del sistema.", {
            event_id: event.event_id,
            service,
            status: response.status,
          });
          break;
        }
        let acknowledgement;
        try {
          acknowledgement = await response.json();
        } catch {
          console.error("El servicio receptor no devolvió una confirmación JSON válida.", {
            event_id: event.event_id,
            service,
            status: response.status,
          });
          break;
        }
        const expectedStatus = response.status === 201 ? "created" : "duplicate";
        if (
          acknowledgement?.event_id !== event.event_id ||
          acknowledgement?.ingest_status !== expectedStatus
        ) {
          console.error("El servicio receptor no confirmó el evento esperado.", {
            event_id: event.event_id,
            service,
            status: response.status,
          });
          break;
        }
        pending = pending.slice(1);
        writeOutbox(pending);
      } catch (error) {
        console.error("La entrega de un evento quedó pendiente en el outbox.", {
          event_id: event.event_id,
          service,
          error: error instanceof Error ? error.message : "error de red",
        });
        break;
      }
    }
  } catch (error) {
    console.error("No se pudo leer o entregar el outbox local; se conserva para reintento.", {
      service,
      error: error instanceof Error ? error.message : "error local",
    });
  } finally {
    flushing = false;
  }
}

function publishSystemEvent({
  event_id = randomUUID(),
  timestamp,
  usuario_id = null,
  tipo_evento,
  entidad,
  entidad_id = null,
  resultado = "EXITOSO",
  ip,
  metadata = {},
}) {
  if (!service || !correlationUrl || !outboxPath) {
    if (!warnedNotConfigured) {
      console.error("Emisión de eventos deshabilitada: falta configuración del emisor y del outbox.", {
        service: service || "desconocido",
      });
      warnedNotConfigured = true;
    }
    return;
  }

  const createdAt = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    console.error("No se emitió un evento porque su marca temporal no es válida.", {
      event_id,
      service,
    });
    return;
  }
  let actorId = usuario_id;
  if (typeof actorId === "bigint") {
    actorId = actorId >= 0n && actorId <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(actorId)
      : actorId.toString();
  } else if (typeof actorId === "string" && /^\d+$/.test(actorId)) {
    const numericActorId = Number(actorId);
    if (Number.isSafeInteger(numericActorId)) actorId = numericActorId;
  }
  const entityId = typeof entidad_id === "bigint" ? entidad_id.toString() : entidad_id;
  const candidate = {
    event_id,
    service,
    usuario_id: actorId,
    tipo_evento,
    entidad,
    entidad_id: entityId,
    timestamp: createdAt.toISOString(),
    resultado,
    ...(ip === undefined ? {} : { ip }),
    metadata,
  };
  const validated = validateSystemEvent(candidate);
  if (!validated.ok) {
    console.error("No se emitió un evento que no cumple el contrato compartido.", {
      event_id,
      service,
      error: validated.error,
    });
    return;
  }
  const event = validated.event;
  try {
    const pending = readOutbox();
    const existing = pending.find((item) => item.event_id === event.event_id);
    if (existing && !isDeepStrictEqual(existing, event)) {
      console.error("event_id ya está pendiente con contenido diferente.", {
        event_id: event.event_id,
        service,
      });
      return;
    }
    if (!existing) {
      pending.push(event);
      writeOutbox(pending);
    }
    void flushOutbox();
  } catch (error) {
    console.error("No se pudo persistir un evento en el outbox local.", {
      event_id: event.event_id,
      service,
      error: error instanceof Error ? error.message : "error local",
    });
  }
}

if (correlationUrl && outboxPath) {
  const timer = setInterval(() => void flushOutbox(), 5000);
  timer.unref();
  void flushOutbox();
}

module.exports = { publishSystemEvent, flushOutbox };
