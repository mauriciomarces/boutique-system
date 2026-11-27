const PERMISOS_RECOMENDADOS_POR_ROL = Object.freeze({
  ADMIN: null,
  SUPERVISOR: Object.freeze([
    'VENTAS_LEER',
    'CLIENTES_LEER',
    'PRODUCTOS_LEER',
    'INVENTARIO_LEER',
    'NOTIFICACIONES_LEER',
  ]),
  VENDEDOR: Object.freeze([
    'VENTAS_LEER',
    'VENTAS_CREAR',
    'CLIENTES_LEER',
    'CLIENTES_CREAR',
    'CLIENTES_EDITAR',
    'PRODUCTOS_LEER',
    'INVENTARIO_LEER',
  ]),
  INVENTARIO: Object.freeze([
    'PRODUCTOS_LEER',
    'INVENTARIO_LEER',
    'INVENTARIO_EDITAR',
    'VENTAS_LEER',
  ]),
  CONSULTA: Object.freeze([
    'VENTAS_LEER',
    'CLIENTES_LEER',
    'PRODUCTOS_LEER',
    'INVENTARIO_LEER',
    'NOTIFICACIONES_LEER',
  ]),
});

/**
 * Calcula permisos desde relaciones activas; ADMIN usa el catálogo actual
 * para incluir permisos nuevos sin asignaciones manuales.
 */
function tieneRolAdminActivo(usuario) {
  return (usuario?.usuario_rol || []).some(({ roles: rol }) =>
    rol &&
    String(rol.estado).toUpperCase() === 'ACTIVO' &&
    String(rol.nombre).toUpperCase() === 'ADMIN'
  );
}

function usuarioTieneRolActivo(usuario) {
  return (usuario?.usuario_rol || []).some(({ roles }) =>
    roles &&
    String(roles.estado).toUpperCase() === 'ACTIVO'
  );
}

function usuarioTieneRolPermitido(usuario, rolesPermitidos) {
  if (!Array.isArray(rolesPermitidos) || rolesPermitidos.length === 0) {
    return false;
  }

  return (usuario?.usuario_rol || []).some(({ roles }) =>
    String(roles?.estado).toUpperCase() === 'ACTIVO' &&
    rolesPermitidos.some(
      (role) =>
        String(role).toUpperCase() === String(roles?.nombre).toUpperCase(),
    )
  );
}

function obtenerPermisosEfectivos(usuario, permisosDisponibles = []) {
  const nombres = new Set();

  if (tieneRolAdminActivo(usuario)) {
    for (const permiso of permisosDisponibles || []) {
      const nombre = typeof permiso === 'string' ? permiso : permiso?.nombre;
      if (typeof nombre === 'string' && nombre) nombres.add(nombre);
    }

    return [...nombres].sort();
  }

  for (const relacion of usuario?.usuario_rol || []) {
    const rol = relacion?.roles;
    if (!rol || String(rol.estado).toUpperCase() !== 'ACTIVO') continue;

    for (const asignacion of rol.rol_permiso || []) {
      const nombre = asignacion?.permisos?.nombre;
      if (typeof nombre === 'string' && nombre) nombres.add(nombre);
    }
  }

  return [...nombres].sort();
}

function obtenerPermisosRecomendados(nombreRol, catalogoPermisos = []) {
  const nombre = String(nombreRol || '').toUpperCase();
  const recomendados = PERMISOS_RECOMENDADOS_POR_ROL[nombre];
  if (recomendados === undefined) return null;

  const catalogo = (catalogoPermisos || [])
    .map((permiso) => typeof permiso === 'string' ? permiso : permiso?.nombre)
    .filter((permiso) => typeof permiso === 'string' && permiso);
  const recomendadosSet = recomendados === null
    ? new Set(catalogo)
    : new Set(recomendados);

  return [...new Set(catalogo)]
    .filter((permiso) => recomendadosSet.has(permiso))
    .sort();
}

async function guardarPlantillaPermisos(
  prisma,
  rolId,
  nombreRol,
  catalogoPermisos,
) {
  const nombres = obtenerPermisosRecomendados(nombreRol, catalogoPermisos);
  if (!nombres) return null;

  const permisos = catalogoPermisos.filter((permiso) =>
    nombres.includes(permiso.nombre),
  );
  await prisma.$transaction(async (transaction) => {
    await transaction.rol_permiso.deleteMany({
      where: { rol_id: rolId },
    });
    for (const permiso of permisos) {
      await transaction.rol_permiso.create({
        data: { rol_id: rolId, permiso_id: permiso.id },
      });
    }
  });

  return permisos;
}

module.exports = {
  PERMISOS_RECOMENDADOS_POR_ROL,
  guardarPlantillaPermisos,
  obtenerPermisosEfectivos,
  obtenerPermisosRecomendados,
  tieneRolAdminActivo,
  usuarioTieneRolActivo,
  usuarioTieneRolPermitido,
};
