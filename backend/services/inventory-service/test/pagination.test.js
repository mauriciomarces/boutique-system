const assert = require('node:assert/strict');
const test = require('node:test');

const { parseMovementLimit } = require('../src/pagination');

test('movement limit is optional and accepts values from 1 to 100', () => {
  assert.equal(parseMovementLimit(undefined), undefined);
  assert.equal(parseMovementLimit('1'), 1);
  assert.equal(parseMovementLimit('100'), 100);
});

test('movement limit rejects malformed, non-positive, and oversized values', () => {
  for (const value of ['', '0', '-1', '1.5', '101', '1e3', '1,2']) {
    assert.throws(() => parseMovementLimit(value));
  }
});
