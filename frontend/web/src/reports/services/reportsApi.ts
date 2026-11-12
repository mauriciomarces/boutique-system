import { getAccessToken } from "../../auth/services/session";

export type ReportOperation = {
  id: string;
  fecha: string;
  cliente: string | null;
  responsable: string | null;
  importe: number;
  estado: string;
  pagosRecibidos: number;
};

export type ReportDay = {
  fecha: string;
  cantidadVentas: number;
  ventasRegistradas: number;
  ventasCanceladas: number;
  ingresosPorVentas: number;
};

export type SalesReport = {
  tipo: "diario" | "mensual" | "ventas" | "ingresos";
  fecha?: string;
  mes?: number;
  anio?: number;
  desde?: string;
  hasta?: string;
  ventasRegistradas?: number;
  cantidadVentas?: number;
  ventasCanceladas?: number;
  ingresosPorVentas?: number;
  pagosRecibidos?: number;
  resumenPorDia?: ReportDay[];
  desglosePorDia?: Array<{
    fecha: string;
    ingresosPorVentas: number;
    pagosRecibidos: number;
  }>;
  operaciones: ReportOperation[];
};

export type ReportType = SalesReport["tipo"] | "egresos";

async function getReport<T>(path: string): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error("No hay sesión activa.");

  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || "No se pudo consultar el reporte.");
  }

  return body as T;
}

export function getDailyReport(date: string) {
  const query = new URLSearchParams({ fecha: date });
  return getReport<SalesReport>(`/api/reportes/diario?${query}`);
}

export function getMonthlyReport(month: number, year: number) {
  const query = new URLSearchParams({
    mes: String(month),
    anio: String(year),
  });
  return getReport<SalesReport>(`/api/reportes/mensual?${query}`);
}

export function getSalesReport(
  from: string,
  to: string,
  status: string,
  clientId: string,
) {
  const query = new URLSearchParams({ desde: from, hasta: to });
  if (status) query.set("estado", status);
  if (clientId) query.set("cliente_id", clientId);
  return getReport<SalesReport>(`/api/reportes/ventas?${query}`);
}

export function getIncomeReport(from: string, to: string) {
  const query = new URLSearchParams({ desde: from, hasta: to });
  return getReport<SalesReport>(`/api/reportes/ingresos?${query}`);
}
