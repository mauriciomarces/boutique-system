const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerPermisosEfectivos } = require('../src/permisos');

const permiso = (nombre) => ({ permisos: { nombre } });

test('combina permisos de varios roles activos sin duplicados', () => {
  const usuario = {
    usuario_rol: [
      { roles: { estado: 'ACTIVO', rol_permiso: [permiso('VENTAS_LEER'), permiso('VENTAS_CREAR')] } },
      { roles: { estado: 'ACTIVO', rol_permiso: [permiso('VENTAS_LEER'), permiso('INVENTARIO_LEER')] } },
    ],
  };
  assert.deepEqual(obtenerPermisosEfectivos(usuario), [
    'INVENTARIO_LEER',
    'VENTAS_CREAR',
    'VENTAS_LEER',
  ]);
});

test('ignora permisos de roles inactivos', () => {
  const usuario = {
    usuario_rol: [
      { roles: { estado: 'INACTIVO', rol_permiso: [permiso('USUARIOS_LEER')] } },
      { roles: { estado: 'ACTIVO', rol_permiso: [permiso('CLIENTES_LEER')] } },
    ],
  };
  assert.deepEqual(obtenerPermisosEfectivos(usuario), ['CLIENTES_LEER']);
});

test('usuario sin roles no recibe permisos', () => {
  assert.deepEqual(obtenerPermisosEfectivos({ usuario_rol: [] }), []);
  assert.deepEqual(obtenerPermisosEfectivos({}), []);
  assert.deepEqual(obtenerPermisosEfectivos(undefined), []);
});

test('ignora relaciones incompletas sin lanzar error', () => {
  const usuario = {
    usuario_rol: [
      { roles: null },
      { roles: { estado: 'ACTIVO', rol_permiso: [{ permisos: null }, permiso('PRODUCTOS_LEER')] } },
    ],
  };
  assert.deepEqual(obtenerPermisosEfectivos(usuario), ['PRODUCTOS_LEER']);
});
