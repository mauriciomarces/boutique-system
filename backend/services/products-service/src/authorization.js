function permissionForProductWrite(method, path) {
  if (
    method === 'POST' &&
    /^\/(categorias|productos|variantes)\/?$/.test(path)
  ) {
    return 'PRODUCTOS_CREAR';
  }
  if (
    ['PUT', 'PATCH'].includes(method) &&
    /^\/(categorias|productos|variantes)\/[^/]+\/?$/.test(path)
  ) {
    return 'PRODUCTOS_EDITAR';
  }
  if (
    method === 'PATCH' &&
    /^\/(categorias|productos|variantes)\/[^/]+\/estado\/?$/.test(path)
  ) {
    return 'PRODUCTOS_EDITAR';
  }
  return null;
}

function createProductAuthorizationMiddleware({
  usersServiceUrl = process.env.USERS_SERVICE_URL,
  internalSecret = process.env.INTERNAL_SERVICE_SECRET,
} = {}) {
  return async (req, res, next) => {
    const permission = permissionForProductWrite(req.method.toUpperCase(), req.path);
    if (!permission) return next();

    const authorization = req.get('authorization');
    if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    if (!usersServiceUrl || !internalSecret) {
      console.error('La validación de autorización de productos no está configurada.');
      return res.status(503).json({ error: 'Servicio de autorización no disponible' });
    }

    try {
      const authResponse = await fetch(
        `${usersServiceUrl.replace(/\/+$/, '')}/internal/auth/validate`,
        {
          method: 'POST',
          headers: {
            authorization,
            'x-internal-service-key': internalSecret,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ permission }),
          signal: AbortSignal.timeout(5000),
        },
      );
      let authResult;
      try {
        authResult = await authResponse.json();
      } catch {
        console.error('users-service devolvió una respuesta no válida para productos.');
        return res.status(503).json({ error: 'No se pudo verificar la autorización' });
      }

      if (authResponse.status === 401 || authResponse.status === 403) {
        return res.status(authResponse.status).json({
          error: authResult.error || 'No tienes permiso para esta operación',
        });
      }
      if (!authResponse.ok || authResult.valid !== true || !authResult.user) {
        console.error('users-service no pudo confirmar la autorización de productos.', authResponse.status);
        return res.status(503).json({ error: 'No se pudo verificar la autorización' });
      }

      req.authenticatedUser = authResult.user;
      return next();
    } catch (error) {
      console.error('Error al consultar users-service para productos:', error.name || 'Error');
      return res.status(503).json({ error: 'Servicio de autorización no disponible' });
    }
  };
}

module.exports = { createProductAuthorizationMiddleware, permissionForProductWrite };
