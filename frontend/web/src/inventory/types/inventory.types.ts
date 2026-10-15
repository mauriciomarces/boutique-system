export interface InventoryItem {
  id: string | number;
  variante_producto_id: string | number;
  cantidad: number | string;
  cantidad_minima: number | string;
  actualizado_en?: string | null;
}

export type InventoryMovementType = "ENTRADA" | "SALIDA" | "AJUSTE";

export interface InventoryMovement {
  id: string | number;
  variante_producto_id: string | number;
  tipo_movimiento: InventoryMovementType | string;
  cantidad: number | string;
  referencia_tipo?: string | null;
  referencia_id?: string | number | null;
  motivo?: string | null;
  creado_en?: string | null;
  created_at?: string | null;
}

export interface InventoryQuery {
  stock_bajo?: boolean;
  variante_producto_id?: string;
}