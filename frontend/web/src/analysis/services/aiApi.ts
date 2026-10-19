import type { MetricsPayload, ModelMetadata, TrainingSummary } from "../types/training.types";

async function request<T>(path: string): Promise<T> {
  const token = localStorage.getItem("sposabella_access_token");
  if (!token) throw new Error("Inicia sesión para consultar el servicio de IA.");
  const response = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      payload?.error ||
      "No se pudo consultar el servicio de IA.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload as T;
}

export function listTrainings() {
  return request<TrainingSummary[]>("/ai/training");
}

export function getTraining(id: string) {
  return request<TrainingSummary>(`/ai/training/${id}`);
}

export function getMetrics() {
  return request<MetricsPayload>("/ai/metrics");
}

export function getCurrentModel() {
  return request<ModelMetadata>("/ai/model");
}
