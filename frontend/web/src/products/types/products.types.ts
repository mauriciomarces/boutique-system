export type ProductStatus = "ACTIVO" | "INACTIVO";

export interface Category {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: ProductStatus;
  creado_en: string;
  actualizado_en: string;
}

export interface Product {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  estado: ProductStatus;
  creado_en: string;
  actualizado_en: string;
  categorias?: Category | null;
  variantes?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  producto_id: string;
  sku: string;
  talla: string | null;
  color: string | null;
  precio: string;
  estado: ProductStatus;
}

export interface CategoryForm {
  nombre: string;
  descripcion: string;
}

export interface ProductForm {
  categoria_id: string;
  nombre: string;
  descripcion: string;
}

export interface ApiListResponse<T> {
  value: T[];
  Count: number;
}