const test = require('node:test');
const assert = require('node:assert/strict');
const {
  guardarPlantillaPermisos,
  obtenerPermisosEfectivos,
  obtenerPermisosRecomendados,
  usuarioTieneRolPermitido,
} = require('../src/permisos');

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

test('ADMIN activo recibe todos los permisos del catálogo, sin importar el casing', () => {
  const usuario = {
    usuario_rol: [
      { roles: { nombre: 'aDmIn', estado: 'activo', rol_permiso: [] } },
    ],
  };
  assert.deepEqual(
    obtenerPermisosEfectivos(usuario, [
      { nombre: 'VENTAS_LEER' },
      { nombre: 'REPORTES_LEER' },
      { nombre: 'VENTAS_LEER' },
    ]),
    ['REPORTES_LEER', 'VENTAS_LEER'],
  );
});

test('ADMIN activo no depende de asignaciones individuales en rol_permiso', () => {
  const usuario = {
    usuario_rol: [
      { roles: { nombre: 'ADMIN', estado: 'ACTIVO', rol_permiso: [] } },
    ],
  };
  assert.deepEqual(
    obtenerPermisosEfectivos(usuario, ['NUEVO_PERMISO']),
    ['NUEVO_PERMISO'],
  );
});

test('ADMIN inactivo no recibe privilegios', () => {
  const usuario = {
    usuario_rol: [
      {
        roles: {
          nombre: 'ADMIN',
          estado: 'INACTIVO',
          rol_permiso: [permiso('USUARIOS_LEER')],
        },
      },
    ],
  };
  assert.deepEqual(
    obtenerPermisosEfectivos(usuario, ['USUARIOS_LEER', 'VENTAS_LEER']),
    [],
  );
});

test('VENDEDOR solo recibe los permisos asignados', () => {
  const usuario = {
    usuario_rol: [
      {
        roles: {
          nombre: 'VENDEDOR',
          estado: 'ACTIVO',
          rol_permiso: [permiso('VENTAS_LEER'), permiso('VENTAS_CREAR')],
        },
      },
    ],
  };
  assert.deepEqual(
    obtenerPermisosEfectivos(usuario, ['USUARIOS_LEER', 'VENTAS_LEER']),
    ['VENTAS_CREAR', 'VENTAS_LEER'],
  );
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

test('las plantillas recomendadas se filtran con el catálogo actual del backend', () => {
  const catalogo = [
    { nombre: 'VENTAS_LEER' },
    { nombre: 'VENTAS_CREAR' },
    { nombre: 'ROLES_LEER' },
    { nombre: 'PERMISO_AGREGADO' },
  ];

  assert.deepEqual(
    obtenerPermisosRecomendados('supervisor', catalogo),
    ['VENTAS_LEER'],
  );
  assert.deepEqual(
    obtenerPermisosRecomendados('admin', catalogo),
    ['PERMISO_AGREGADO', 'ROLES_LEER', 'VENTAS_CREAR', 'VENTAS_LEER'],
  );
  assert.equal(obtenerPermisosRecomendados('ROL_DESCONOCIDO', catalogo), null);
});

test('aplicar plantilla reemplaza personalizaciones solo por acción explícita y es repetible', async () => {
  const assignments = [
    { rol_id: 7n, permiso_id: 100n },
    { rol_id: 8n, permiso_id: 101n },
  ];
  const transaction = {
    rol_permiso: {
      deleteMany: async ({ where }) => {
        for (let index = assignments.length - 1; index >= 0; index -= 1) {
          if (assignments[index].rol_id === where.rol_id) {
            assignments.splice(index, 1);
          }
        }
      },
      create: async ({ data }) => {
        assignments.push(data);
      },
    },
  };
  const prisma = {
    $transaction: async (callback) => callback(transaction),
  };
  const catalogo = [
    { id: 1n, nombre: 'VENTAS_LEER' },
    { id: 2n, nombre: 'VENTAS_CREAR' },
    { id: 3n, nombre: 'ROLES_LEER' },
  ];

  const first = await guardarPlantillaPermisos(
    prisma,
    7n,
    'VENDEDOR',
    catalogo,
  );
  await guardarPlantillaPermisos(prisma, 7n, 'VENDEDOR', catalogo);

  assert.deepEqual(
    first.map(({ nombre }) => nombre),
    ['VENTAS_LEER', 'VENTAS_CREAR'],
  );
  assert.deepEqual(
    assignments.filter(({ rol_id }) => rol_id === 7n),
    [{ rol_id: 7n, permiso_id: 1n }, { rol_id: 7n, permiso_id: 2n }],
  );
  assert.equal(assignments.some(({ rol_id }) => rol_id === 8n), true);
});

test('solo acepta roles activos incluidos explícitamente en la lista permitida', () => {
  const usuario = {
    usuario_rol: [
      { roles: { nombre: 'VENDEDOR', estado: 'ACTIVO' } },
      { roles: { nombre: 'supervisor', estado: 'activo' } },
      { roles: { nombre: 'ADMIN', estado: 'INACTIVO' } },
    ],
  };
  assert.equal(usuarioTieneRolPermitido(usuario, ['SUPERVISOR', 'ADMIN']), true);
  assert.equal(usuarioTieneRolPermitido(usuario, ['ADMIN']), false);
  assert.equal(usuarioTieneRolPermitido(usuario, []), false);
});
