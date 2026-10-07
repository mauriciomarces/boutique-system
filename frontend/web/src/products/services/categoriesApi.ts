import type {
  Category,
  CategoryForm,
} from "../types/products.types";

const API_BASE_URL = "/api/categorias";

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
    throw new Error(
      data?.error ||
        data?.message ||
        "No se pudo completar la operaci�n.",
    );
  }

  return data as T;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (
    data &&
    typeof data === "object" &&
    "value" in data &&
    Array.isArray((data as { value?: unknown }).value)
  ) {
    return (data as { value: T[] }).value;
  }

  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: T[] }).data;
  }

  return [];
}

export async function getCategories(
  buscar = "",
): Promise<Category[]> {
  const query = buscar.trim()
    ? `?buscar=${encodeURIComponent(buscar.trim())}`
    : "";

  const response = await request<unknown>(query);

  return unwrapList<Category>(response);
}

export async function getCategory(
  id: string,
): Promise<Category> {
  return request<Category>(`/${id}`);
}

export async function createCategory(
  data: CategoryForm,
): Promise<Category> {
  return request<Category>("", {
    method: "POST",
    body: JSON.stringify({
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim() || null,
    }),
  });
}

export async function updateCategory(
  id: string,
  data: CategoryForm,
): Promise<Category> {
  return request<Category>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim() || null,
    }),
  });
}

export async function changeCategoryStatus(
  id: string,
  estado: "ACTIVO" | "INACTIVO",
): Promise<Category> {
  return request<Category>(`/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}
