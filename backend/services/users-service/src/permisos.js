/**
 * Calcula los permisos efectivos de un usuario a partir de sus roles activos.
 *
 * Recibe un usuario con la forma de Prisma:
 *   { usuario_rol: [{ roles: { estado, rol_permiso: [{ permisos: { nombre } }] } }] }
 *
 * Devuelve una lista ordenada y sin duplicados con los nombres de permiso.
 */
function obtenerPermisosEfectivos(usuario) {
  const nombres = new Set();

  for (const relacion of usuario?.usuario_rol || []) {
    const rol = relacion?.roles;
    if (!rol || rol.estado !== 'ACTIVO') continue;

    for (const asignacion of rol.rol_permiso || []) {
      const nombre = asignacion?.permisos?.nombre;
      if (typeof nombre === 'string' && nombre) nombres.add(nombre);
    }
  }

  return [...nombres].sort();
}

module.exports = { obtenerPermisosEfectivos };
