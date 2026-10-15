const http = require('node:http');

const port = Number(process.env.PORT || 4011);
const inventoryUrl = process.env.INVENTORY_SERVICE_URL;
const controlSecret = process.env.INTEGRATION_INTERNAL_SERVICE_SECRET;
let nextFault = null;

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16384) throw new Error('Request body too large');
  }
  return body;
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'POST' && request.url === '/__test/control') {
    if (
      !controlSecret ||
      request.headers['x-test-control-secret'] !== controlSecret
    ) {
      send(response, 401, { error: 'No autorizado' });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(await readBody(request));
    } catch {
      send(response, 400, { error: 'Solicitud inválida' });
      return;
    }

    if (
      !['timeout_after_commit', 'fail_before_commit'].includes(payload.mode) ||
      (payload.variantId !== undefined &&
        !/^\d+$/.test(String(payload.variantId)))
    ) {
      send(response, 400, { error: 'Modo de fallo inválido' });
      return;
    }

    nextFault = {
      mode: payload.mode,
      variantId: payload.variantId === undefined
        ? null
        : String(payload.variantId),
    };
    send(response, 200, { armed: true });
    return;
  }

  if (
    request.method !== 'POST' ||
    request.url !== '/internal/ventas/movimientos'
  ) {
    send(response, 404, { error: 'Ruta no encontrada' });
    return;
  }

  let body;
  let payload;
  try {
    body = await readBody(request);
    payload = JSON.parse(body);
  } catch {
    send(response, 400, { error: 'Solicitud inválida' });
    return;
  }

  const appliesToRequest = nextFault &&
    (!nextFault.variantId ||
      nextFault.variantId === String(payload.variante_producto_id));

  if (appliesToRequest && nextFault.mode === 'fail_before_commit') {
    nextFault = null;
    send(response, 503, { error: 'Fallo transitorio de integración' });
    return;
  }

  const fault = appliesToRequest ? nextFault : null;
  if (fault) nextFault = null;

  let upstream;
  let upstreamBody;
  try {
    upstream = await fetch(`${inventoryUrl}${request.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sales-inventory-secret':
          request.headers['x-sales-inventory-secret'] || '',
      },
      body,
    });
    upstreamBody = await upstream.text();
  } catch {
    send(response, 502, { error: 'Inventario no disponible' });
    return;
  }

  if (fault?.mode === 'timeout_after_commit') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') ||
      'application/json',
  });
  response.end(upstreamBody);
});

server.listen(port, '0.0.0.0');
