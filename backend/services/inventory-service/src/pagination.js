function parseMovementLimit(value) {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw new Error('limit debe ser un entero positivo');
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > 100) {
    throw new Error('limit no puede superar 100');
  }

  return limit;
}

module.exports = { parseMovementLimit };
