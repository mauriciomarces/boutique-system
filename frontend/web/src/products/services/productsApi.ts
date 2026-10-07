import type {
  Product,
  ProductForm,
} from "../types/products.types";

const API_BASE_URL = "/api/productos";

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

export async function getProducts(
  buscar = "",
): Promise<Product[]> {
  const query = buscar.trim()
    ? `?buscar=${encodeURIComponent(buscar.trim())}`
    : "";

  const response = await request<unknown>(query);

  return unwrapList<Product>(response);
}

export async function getProduct(
  id: string,
): Promise<Product> {
  return request<Product>(`/${id}`);
}

export async function createProduct(
  data: ProductForm,
): Promise<Product> {
  return request<Product>("", {
    method: "POST",
    body: JSON.stringify({
      categoria_id: data.categoria_id,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim() || null,
    }),
  });
}

export async function updateProduct(
  id: string,
  data: ProductForm,
): Promise<Product> {
  return request<Product>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      categoria_id: data.categoria_id,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion.trim() || null,
    }),
  });
}

export async function changeProductStatus(
  id: string,
  estado: "ACTIVO" | "INACTIVO",
): Promise<Product> {
  return request<Product>(`/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}
