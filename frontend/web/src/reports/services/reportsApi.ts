import { getAccessToken } from "../../auth/services/session";

export type ReportOperation = {
  id: string;
  fecha: string;
  cliente: string | null;
  responsable: string | null;
  importe: number;
  estado: string;
  pagosRecibidos: number;
  metodosPago: string[];
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

export type SalesReportFilters = {
  status?: string;
  clientId?: string;
  clientName?: string;
  saleId?: string;
  minAmount?: string;
  maxAmount?: string;
  paymentStatus?: string;
  paymentMethod?: string;
};

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
  filters: SalesReportFilters = {},
) {
  const query = new URLSearchParams({ desde: from, hasta: to });
  if (filters.status) query.set("estado", filters.status);
  if (filters.clientId) query.set("cliente_id", filters.clientId);
  if (filters.clientName) query.set("cliente", filters.clientName);
  if (filters.saleId) query.set("venta_id", filters.saleId);
  if (filters.minAmount) query.set("importe_min", filters.minAmount);
  if (filters.maxAmount) query.set("importe_max", filters.maxAmount);
  if (filters.paymentStatus) query.set("estado_pago", filters.paymentStatus);
  if (filters.paymentMethod) query.set("metodo_pago", filters.paymentMethod);
  return getReport<SalesReport>(`/api/reportes/ventas?${query}`);
}

export function getIncomeReport(from: string, to: string) {
  const query = new URLSearchParams({ desde: from, hasta: to });
  return getReport<SalesReport>(`/api/reportes/ingresos?${query}`);
}
