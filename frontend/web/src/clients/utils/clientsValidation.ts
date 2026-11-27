export type ClientFormData = {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono: string;
  correo: string;
};

export type ClientFormErrors = {
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  telefono?: string;
  correo?: string;
};

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeClientForm(
  form: ClientFormData,
): ClientFormData {
  return {
    nombre: normalizeSpaces(form.nombre),
    apellido_paterno: normalizeSpaces(form.apellido_paterno),
    apellido_materno: normalizeSpaces(form.apellido_materno),
    telefono: form.telefono.trim(),
    correo: form.correo.trim().toLowerCase(),
  };
}

export function validateClientForm(
  form: ClientFormData,
): ClientFormErrors {
  const errors: ClientFormErrors = {};

  const nombre = normalizeSpaces(form.nombre);
  const apellidoPaterno = normalizeSpaces(form.apellido_paterno);
  const apellidoMaterno = normalizeSpaces(form.apellido_materno);
  const telefono = form.telefono.trim();
  const correo = form.correo.trim().toLowerCase();

  const nameRegex =
    /^\p{L}+(?:[ '-]\p{L}+)*$/u;

  if (!nombre) {
    errors.nombre = "El nombre es obligatorio.";
  } else if (nombre.length > 100) {
    errors.nombre =
      "El nombre no puede superar los 100 caracteres.";
  } else if (!nameRegex.test(nombre)) {
    errors.nombre =
      "El nombre solo puede contener letras, espacios, apóstrofes y guiones.";
  }

  if (!apellidoPaterno) {
    errors.apellido_paterno = "El apellido paterno es obligatorio.";
  } else if (apellidoPaterno.length > 100) {
    errors.apellido_paterno =
      "El apellido paterno no puede superar los 100 caracteres.";
  } else if (!nameRegex.test(apellidoPaterno)) {
    errors.apellido_paterno =
      "El apellido paterno solo puede contener letras, espacios, apóstrofes y guiones.";
  }

  if (apellidoMaterno.length > 100) {
    errors.apellido_materno =
      "El apellido materno no puede superar los 100 caracteres.";
  } else if (apellidoMaterno && !nameRegex.test(apellidoMaterno)) {
    errors.apellido_materno =
      "El apellido materno solo puede contener letras, espacios, apóstrofes y guiones.";
  }

  if (telefono) {
    if (!/^\d{8,9}$/.test(telefono)) {
      errors.telefono =
        "El teléfono debe contener entre 8 y 9 dígitos.";
    }
  }

  if (correo) {
    if (correo.length > 150) {
      errors.correo =
        "El correo no puede superar los 150 caracteres.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    ) {
      errors.correo =
        "El correo electrónico no tiene un formato válido.";
    }
  }

  return errors;
}
