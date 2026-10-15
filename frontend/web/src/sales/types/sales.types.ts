export type SaleStatus =
  | "PENDIENTE"
  | "CONFIRMADA"
  | "ANULADA";

export type PaymentStatus =
  | "PENDIENTE"
  | "PAGADO"
  | "ANULADO";

export type CancellationStatus =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "REINTENTABLE"
  | "COMPLETADA";

export interface SaleDetail {
  id: string;
  venta_id: string;
  variante_producto_id: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
}

export interface Payment {
  id: string;
  venta_id: string;
  metodo_pago: string;
  monto: string;
  estado: PaymentStatus | string;
  fecha_pago: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface SaleClient {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string | null;
  estado: "ACTIVO" | "INACTIVO";
}

export interface Sale {
  id: string;
  cliente_id: string | null;
  fecha_venta: string;
  estado: SaleStatus | string;
  subtotal: string;
  total: string;
  creado_en: string;
  actualizado_en: string;
  clientes?: SaleClient | null;
  detalle_ventas: SaleDetail[];
  pagos: Payment[];
}

export interface CancellationTask {
  id: string;
  estado: CancellationStatus;
  cantidad: number;
  idempotency_key: string;
  movimiento_inventario_id: string | null;
  ultimo_error: string | null;
}

export interface CancellationOperation {
  id: string;
  venta_id: string;
  estado: CancellationStatus;
  intentos: number;
  ultimo_error: string | null;
  tareas: CancellationTask[];
}

export interface CancellationResponse {
  venta: Sale | null;
  anulacion: CancellationOperation;
}

export type SaleStatusResponse = Sale | CancellationResponse;

export interface SaleCreateDetail {
  variante_producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export interface SaleCreateForm {
  cliente_id: string;
  fecha_venta: string;
  detalles: SaleCreateDetail[];
}

export interface PaymentCreateForm {
  venta_id: string;
  metodo_pago: string;
  monto: number;
}
