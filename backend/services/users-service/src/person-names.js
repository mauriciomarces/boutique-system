function normalizePersonName(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} solo puede contener letras y espacios válidos`);
  }

  const text = value.trim();
  if (!text || !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/.test(text)) {
    throw new Error(`${fieldName} solo puede contener letras y espacios válidos`);
  }
  if (text.length > 100) {
    throw new Error(`${fieldName} no puede superar los 100 caracteres`);
  }

  return text;
}

function normalizeOptionalPersonName(value, fieldName) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  return normalizePersonName(value, fieldName);
}

module.exports = {
  normalizePersonName,
  normalizeOptionalPersonName,
};
