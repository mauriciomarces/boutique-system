const MAX_EVENTS = Number(process.env.MAX_IN_MEMORY_EVENTS || 20000);

const events = [];

function reset() {
  events.length = 0;
}

function addEvent(event) {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  return event;
}

function listEvents({ usuario_id, limit } = {}) {
  let result = events;
  if (usuario_id !== undefined && usuario_id !== null) {
    const id = Number(usuario_id);
    result = result.filter((item) => Number(item.usuario_id) === id);
  }
  if (limit) {
    result = result.slice(-Number(limit));
  }
  return result;
}

module.exports = {
  addEvent,
  listEvents,
  reset,
};
