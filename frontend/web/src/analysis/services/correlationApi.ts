export interface CorrelationEvent {
  event_id: string;
  service: string;
  usuario_id: number | null;
  tipo_evento: string;
  entidad: string;
  entidad_id: number | string | null;
  timestamp: string;
  resultado: "EXITOSO" | "FALLIDO";
  metadata: Record<string, string | number | boolean>;
}

export interface AnalysisTrace {
  analysis_id: string;
  generated_at: string;
  interval: { from: string; to: string };
  usuario_id: number | null;
  event_ids: string[];
  correlation: {
    features: Record<string, number>;
    rules: Record<string, { description: string; fired: boolean; value: number }>;
  };
  classification: {
    clasificacion: "NORMAL" | "ANOMALO";
    nivel_riesgo: string;
    probabilidad?: number;
    probability_semantics: string;
    model_version: string;
    factores: string[];
    camino_arbol: string[];
  };
}

export interface EventFilters {
  usuario_id?: string;
  service?: string;
  tipo_evento?: string;
  from?: string;
  to?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("sposabella_access_token");
  if (!token) throw new Error("Inicia sesión para consultar el análisis.");
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message ?? payload?.detail ?? payload?.error;
    throw new Error(
      typeof message === "string" ? message : "No se pudo consultar el servicio de análisis.",
    );
  }
  return payload as T;
}

function query(filters: EventFilters) {
  const params = new URLSearchParams({ limit: "500" });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export async function listEvents(filters: EventFilters) {
  return request<{ count: number; events: CorrelationEvent[] }>(
    `/correlation/events?${query(filters)}`,
  );
}

export function listAnalyses() {
  return request<{ analyses: AnalysisTrace[] }>("/correlation/analyses");
}

export function classifyEvents(filters: EventFilters) {
  return request<AnalysisTrace>("/correlation/analyze-and-classify", {
    method: "POST",
    body: JSON.stringify({
      ...(filters.usuario_id
        ? { usuario_id: filters.usuario_id === "anonymous" ? null : Number(filters.usuario_id) }
        : {}),
      ...(filters.service ? { service: filters.service } : {}),
      ...(filters.tipo_evento ? { tipo_evento: filters.tipo_evento } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    }),
  });
}
