export interface Notification {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  canal: string;
  estado: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  enviado_en: string | null;
  leido_en: string | null;
  creado_en: string;
}

const API_BASE_URL = "/api/notifications";

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
        "No se pudo completar la operación.",
    );
  }

  return data as T;
}

export async function getNotifications(): Promise<Notification[]> {
  const data = await request<unknown>(API_BASE_URL);

  if (Array.isArray(data)) {
    return data as Notification[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      return record.data as Notification[];
    }

    if (Array.isArray(record.value)) {
      return record.value as Notification[];
    }
  }

  return [];
}

export async function markNotificationAsRead(
  id: string,
): Promise<Notification> {
  return request<Notification>(
    `${API_BASE_URL}/${encodeURIComponent(id)}/read`,
    { method: "PATCH" },
  );
}