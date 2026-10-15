import type {
  Payment,
  PaymentCreateForm,
  Sale,
  SaleCreateForm,
  CancellationOperation,
  CancellationResponse,
  SaleStatusResponse,
  SaleStatus,
} from "../types/sales.types";

const SALES_API = "/api/ventas";
const PAYMENTS_API = "/api/pagos";

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
        "No se pudo completar la operación.",
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

export async function getSales(): Promise<Sale[]> {
  const response = await request<unknown>(SALES_API);

  return unwrapList<Sale>(response);
}

export async function getSale(
  id: string,
): Promise<Sale> {
  return request<Sale>(`${SALES_API}/${id}`);
}

export async function createSale(
  data: SaleCreateForm,
): Promise<Sale> {
  return request<Sale>(SALES_API, {
    method: "POST",
    body: JSON.stringify({
      cliente_id: data.cliente_id || undefined,
      fecha_venta: data.fecha_venta,
      detalles: data.detalles.map((detail) => ({
        variante_producto_id:
          detail.variante_producto_id,
        cantidad: detail.cantidad,
        precio_unitario: detail.precio_unitario,
      })),
    }),
  });
}

export async function changeSaleStatus(
  id: string,
  estado: "ANULADA",
): Promise<CancellationResponse>;
export async function changeSaleStatus(
  id: string,
  estado: SaleStatus,
): Promise<SaleStatusResponse>;
export async function changeSaleStatus(
  id: string,
  estado: SaleStatus,
): Promise<SaleStatusResponse> {
  return request<SaleStatusResponse>(`${SALES_API}/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export async function getSaleCancellation(
  id: string,
): Promise<CancellationOperation> {
  return request<CancellationOperation>(`${SALES_API}/${id}/anulacion`);
}

export async function retrySaleCancellation(
  id: string,
): Promise<CancellationOperation> {
  return request<CancellationOperation>(
    `${SALES_API}/${id}/anulacion/reintentar`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function getPayments(): Promise<Payment[]> {
  const response = await request<unknown>(
    PAYMENTS_API,
  );

  return unwrapList<Payment>(response);
}

export async function createPayment(
  data: PaymentCreateForm,
): Promise<Payment> {
  return request<Payment>(PAYMENTS_API, {
    method: "POST",
    body: JSON.stringify({
      venta_id: data.venta_id,
      metodo_pago: data.metodo_pago
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase(),
      monto: data.monto,
    }),
  });
}
