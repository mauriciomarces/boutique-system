import type {
  Client,
  ClientForm,
} from "../types/clients.types";

const API_BASE_URL = "/api/clientes";

function getAccessToken(): string | null {
  return localStorage.getItem("sposabella_access_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      "Ocurrió un error al comunicarse con el servidor.";

    throw new Error(message);
  }

  return data as T;
}

export async function getClients(
  buscar = "",
): Promise<Client[]> {
  const normalizedSearch = buscar.trim();

  const query = normalizedSearch
    ? `?buscar=${encodeURIComponent(normalizedSearch)}`
    : "";

  return request<Client[]>(query);
}

export async function getClient(
  id: string,
): Promise<Client> {
  return request<Client>(`/${id}`);
}

export async function createClient(
  data: ClientForm,
): Promise<Client> {
  const nombre = data.nombre
    .trim()
    .replace(/\s+/g, " ");

  const apellido = data.apellido
    .trim()
    .replace(/\s+/g, " ");

  const telefono = data.telefono.trim();

  const correo = data.correo
    .trim()
    .toLowerCase();

  return request<Client>("", {
    method: "POST",
    body: JSON.stringify({
      nombre,
      apellido,
      telefono: telefono || null,
      correo: correo || null,
    }),
  });
}

export async function updateClient(
  id: string,
  data: ClientForm,
): Promise<Client> {
  const nombre = data.nombre
    .trim()
    .replace(/\s+/g, " ");

  const apellido = data.apellido
    .trim()
    .replace(/\s+/g, " ");

  const telefono = data.telefono.trim();

  const correo = data.correo
    .trim()
    .toLowerCase();

  return request<Client>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      nombre,
      apellido,
      telefono: telefono || null,
      correo: correo || null,
    }),
  });
}

export async function changeClientStatus(
  id: string,
  estado: "ACTIVO" | "INACTIVO",
): Promise<Client> {
  return request<Client>(`/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}
