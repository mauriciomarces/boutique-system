export interface Client {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  telefono: string | null;
  correo: string | null;
  estado: "ACTIVO" | "INACTIVO";
  creado_en: string;
  actualizado_en: string;
}

export interface ClientForm {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono: string;
  correo: string;
}

export interface ClientListResponse {
  clientes: Client[];
}
