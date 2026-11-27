function normalizeClientText(value, fieldName, maxLength = 100) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} es obligatorio`);
  }

  const text = value.trim().replace(/\s+/g, ' ');

  if (!text) {
    throw new Error(`${fieldName} es obligatorio`);
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldName} no puede superar los ${maxLength} caracteres`,
    );
  }

  if (!/^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(text)) {
    throw new Error(
      `${fieldName} solo puede contener letras, espacios, apóstrofes y guiones`,
    );
  }

  return text;
}

function normalizeOptionalClientText(value, fieldName, maxLength = 100) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  return normalizeClientText(value, fieldName, maxLength);
}

function normalizeClientPhone(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const phone = String(value).trim();

  if (!/^\d{8,9}$/.test(phone)) {
    throw new Error(
      'El teléfono debe contener entre 8 y 9 dígitos',
    );
  }

  return phone;
}

function normalizeClientEmail(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const email = String(value).trim().toLowerCase();

  if (email.length > 150) {
    throw new Error(
      'El correo no puede superar los 150 caracteres',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo electrónico no tiene un formato válido');
  }

  return email;
}

function normalizeClientData(body) {
  const apellidoPaterno = normalizeClientText(
    body.apellido_paterno,
    'El apellido paterno',
  );
  const apellidoMaterno = normalizeOptionalClientText(
    body.apellido_materno,
    'El apellido materno',
  );

  return {
    nombre: normalizeClientText(body.nombre, 'El nombre'),
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    apellido: [apellidoPaterno, apellidoMaterno].filter(Boolean).join(' '),
    telefono: normalizeClientPhone(body.telefono),
    correo: normalizeClientEmail(body.correo),
  };
}

const CLIENT_SELECT = {
  id: true,
  nombre: true,
  apellido_paterno: true,
  apellido_materno: true,
  telefono: true,
  correo: true,
  estado: true,
  creado_en: true,
  actualizado_en: true,
};

const SALE_CLIENT_SELECT = {
  id: true,
  nombre: true,
  apellido_paterno: true,
  apellido_materno: true,
  telefono: true,
  correo: true,
  estado: true,
};

module.exports = {
  CLIENT_SELECT,
  SALE_CLIENT_SELECT,
  normalizeClientData,
};
