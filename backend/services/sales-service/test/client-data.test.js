const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeClientData } = require('../src/client-data');

test('normalizes both surnames while allowing a missing maternal surname', () => {
  assert.deepEqual(
    normalizeClientData({
      nombre: '  Ana   María ',
      apellido_paterno: '  De la Cruz ',
      apellido_materno: ' García ',
      telefono: '',
      correo: '',
    }),
    {
      nombre: 'Ana María',
      apellido_paterno: 'De la Cruz',
      apellido_materno: 'García',
      apellido: 'De la Cruz García',
      telefono: null,
      correo: null,
    },
  );

  const withoutMaternalSurname = normalizeClientData({
    nombre: 'Ana',
    apellido_paterno: 'De la Cruz',
  });
  assert.equal(withoutMaternalSurname.apellido_paterno, 'De la Cruz');
  assert.equal(withoutMaternalSurname.apellido_materno, null);
});

test('requires a valid paternal surname and validates a supplied maternal surname', () => {
  assert.throws(
    () => normalizeClientData({ nombre: 'Ana' }),
    /apellido paterno es obligatorio/,
  );
  assert.throws(
    () => normalizeClientData({
      nombre: 'Ana',
      apellido_paterno: 'Lopez',
      apellido_materno: 'Garcia 2',
    }),
    /apellido materno solo puede contener/,
  );
});
