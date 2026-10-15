const http = require('node:http');

const port = Number(process.env.PORT || 4010);
const internalSecret = process.env.INTEGRATION_INTERNAL_SERVICE_SECRET;
const permissions = new Set([
  'VENTAS_LEER',
  'VENTAS_CREAR',
  'VENTAS_EDITAR',
  'CLIENTES_LEER',
  'CLIENTES_CREAR',
  'CLIENTES_EDITAR',
  'CLIENTES_CAMBIAR_ESTADO',
]);

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (
    request.method !== 'POST' ||
    request.url !== '/internal/auth/validate'
  ) {
    response.writeHead(404);
    response.end();
    return;
  }

  if (
    !internalSecret ||
    request.headers['x-internal-service-key'] !== internalSecret
  ) {
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ valid: false, error: 'No autorizado' }));
    return;
  }

  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) {
      response.writeHead(413);
      response.end();
      return;
    }
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }

  const token = request.headers.authorization;
  const permission = payload?.permission;
  const isAdmin = token === 'Bearer integration-admin-token';
  const isReader = token === 'Bearer integration-reader-token';
  const valid = permissions.has(permission) &&
    (isAdmin || (isReader && permission === 'VENTAS_LEER'));

  response.writeHead(valid ? 200 : 403, {
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(valid
    ? { valid: true, user: { id: '9001' } }
    : { valid: false, error: 'No tienes permiso para esta operación' }));
});

server.listen(port, '0.0.0.0');
