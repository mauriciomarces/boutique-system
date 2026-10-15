import type {
  InventoryItem,
  InventoryMovement,
  InventoryQuery,
} from "../types/inventory.types";

const API_BASE_URL = "/api/inventory";

function getAccessToken(): string | null {
  return localStorage.getItem("sposabella_access_token");
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        "No se pudo completar la operaci\u00F3n.",
    );
  }

  return data as T;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (Array.isArray(record.value)) {
      return record.value as T[];
    }

    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
  }

  return [];
}

export async function getInventory(
  filters: InventoryQuery = {},
): Promise<InventoryItem[]> {
  const params = new URLSearchParams();

  if (filters.stock_bajo) {
    params.set("stock_bajo", "true");
  }

  if (filters.variante_producto_id?.trim()) {
    params.set(
      "variante_producto_id",
      filters.variante_producto_id.trim(),
    );
  }

  const query = params.toString();

  const data = await request<unknown>(
    `${API_BASE_URL}${query ? `?${query}` : ""}`,
  );

  return unwrapList<InventoryItem>(data);
}

export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  const data = await request<unknown>(`${API_BASE_URL}/movimientos`);

  return unwrapList<InventoryMovement>(data);
}