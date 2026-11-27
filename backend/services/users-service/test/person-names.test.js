const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizePersonName,
  normalizeOptionalPersonName,
} = require('../src/person-names');

test('normalizes a compound surname without splitting it', () => {
  assert.equal(
    normalizePersonName('  De la Cruz  ', 'El apellido paterno'),
    'De la Cruz',
  );
});

test('accepts a missing optional surname and validates one when supplied', () => {
  assert.equal(normalizeOptionalPersonName('', 'El apellido materno'), null);
  assert.equal(
    normalizeOptionalPersonName('García-López', 'El apellido materno'),
    'García-López',
  );
  assert.throws(
    () => normalizeOptionalPersonName('García 2', 'El apellido materno'),
    /apellido materno/,
  );
  assert.throws(
    () => normalizePersonName('A'.repeat(101), 'El apellido paterno'),
    /100 caracteres/,
  );
});
