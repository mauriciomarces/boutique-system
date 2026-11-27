#!/usr/bin/env node

const API_BASE_URL = "http://127.0.0.1:4007";
const fs = require("node:fs");
const path = require("node:path");

async function postEvents(events, fetchImplementation = fetch) {
  if (
    !Array.isArray(events) ||
    events.length === 0 ||
    events.some((event) =>
      typeof event?.event_id !== "string" ||
      !event.event_id.startsWith("demo-") ||
      event.metadata?.fixture !== "demo-seed" ||
      !["normal", "anomalous"].includes(event.metadata?.scenario))
  ) {
    throw new Error("La entrada debe contener una lista no vacía de eventos.");
  }

  let created = 0;
  let duplicate = 0;
  for (const [index, event] of events.entries()) {
    const response = await fetchImplementation(`${API_BASE_URL}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`El servicio rechazó el evento ${index + 1} con estado HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (result.event_id !== event.event_id) {
      throw new Error(`La respuesta del servicio no coincide con el evento ${index + 1}.`);
    }
    if (result.ingest_status === "created") created += 1;
    else if (result.ingest_status === "duplicate") duplicate += 1;
    else throw new Error(`El servicio devolvió un estado de ingreso inesperado para el evento ${index + 1}.`);
  }

  return { created, duplicate };
}

async function main() {
  let input;
  if (process.argv[2]) {
    input = fs.readFileSync(path.resolve(process.argv[2]), "utf8");
  } else {
    input = "";
    for await (const chunk of process.stdin) input += chunk;
  }
  let events;
  try {
    events = JSON.parse(input);
  } catch {
    throw new Error("La entrada estándar no contiene JSON válido.");
  }
  const result = await postEvents(events);
  process.stdout.write(`Eventos recibidos por el servicio: ${result.created} creados, ${result.duplicate} ya existentes.\n`);
}

if (require.main === module) {
  main().catch((error) => {
    const cause = error.cause?.code;
    process.stderr.write(`Error: ${error.message}${cause ? ` (${cause})` : ""}\n`);
    process.exitCode = 1;
  });
}

module.exports = { postEvents };
