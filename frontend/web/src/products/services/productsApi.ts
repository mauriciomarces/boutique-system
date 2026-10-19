  import type {
    Product,
    ProductForm,
    ProductStatus,
    ProductVariant,
    ProductVariantForm,
  } from "../types/products.types";

  const API_BASE_URL = "/api/productos";

  function getAccessToken(): string | null {
    return localStorage.getItem("sposabella_access_token");
  }

  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = getAccessToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

  export async function getProducts(
    buscar = "",
  ): Promise<Product[]> {
    const query = buscar.trim()
      ? `?buscar=${encodeURIComponent(buscar.trim())}`
      : "";

    const response = await request<unknown>(query);

    return unwrapList<Product>(response);
  }

  export async function getProduct(
    id: string,
  ): Promise<Product> {
    return request<Product>(`/${id}`);
  }

  export async function getProductVariants(
    productoId: string,
    buscar = "",
    estado?: ProductStatus,
  ): Promise<ProductVariant[]> {
    const query = new URLSearchParams({ producto_id: productoId });
    if (buscar.trim()) query.set("buscar", buscar.trim());
    if (estado) query.set("estado", estado);

    return unwrapList<ProductVariant>(
      await request<unknown>(`/variantes?${query.toString()}`),
    );
  }

  export async function getProductVariant(
    id: string,
  ): Promise<ProductVariant> {
    return request<ProductVariant>(`/variantes/${encodeURIComponent(id)}`);
  }

  function normalizedVariantPayload(
    productId: string,
    variant: Pick<ProductVariantForm, "sku" | "talla" | "color" | "precio">,
  ) {
    const sku = variant.sku.trim().toUpperCase();
    const precio = Number(variant.precio);

    if (!sku) {
      throw new Error("El SKU es obligatorio.");
    }

    if (
      !variant.precio.trim() ||
      !Number.isFinite(precio) ||
      precio <= 0
    ) {
      throw new Error("El precio debe ser un número mayor que cero.");
    }

    return {
      producto_id: productId,
      sku,
      talla: variant.talla.trim() || null,
      color: variant.color.trim() || null,
      precio,
    };
  }

  export async function createProductVariant(
    productId: string,
    variant: Pick<ProductVariantForm, "sku" | "talla" | "color" | "precio">,
  ): Promise<ProductVariant> {
    return request<ProductVariant>("/variantes", {
      method: "POST",
      body: JSON.stringify(normalizedVariantPayload(productId, variant)),
    });
  }

  export async function updateProductVariant(
    id: string,
    productId: string,
    variant: Pick<ProductVariantForm, "sku" | "talla" | "color" | "precio">,
  ): Promise<ProductVariant> {
    return request<ProductVariant>(`/variantes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(normalizedVariantPayload(productId, variant)),
    });
  }

  export async function changeProductVariantStatus(
    id: string,
    estado: ProductStatus,
  ): Promise<ProductVariant> {
    return request<ProductVariant>(
      `/variantes/${encodeURIComponent(id)}/estado`,
      {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      },
    );
  }

  export async function createProduct(
    data: ProductForm,
  ): Promise<Product> {
    if (!data.sku.trim()) {
      throw new Error("El SKU es obligatorio.");
    }

    const precio = Number(data.precio);

    if (!data.precio.trim() || !Number.isFinite(precio) || precio <= 0) {
      throw new Error("El precio debe ser mayor que cero.");
    }

    return request<Product>("", {
      method: "POST",
      body: JSON.stringify({
        categoria_id: data.categoria_id,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion.trim() || null,
        variante: {
          sku: data.sku.trim().toUpperCase(),
          talla: data.talla.trim() || null,
          color: data.color.trim() || null,
          precio,
        },
      }),
    });
  }

  export async function updateProduct(
    id: string,
    data: ProductForm,
  ): Promise<Product> {
    return request<Product>(`/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        categoria_id: data.categoria_id,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion.trim() || null,
      }),
    });
  }

  export async function changeProductStatus(
    id: string,
    estado: "ACTIVO" | "INACTIVO",
  ): Promise<Product> {
    return request<Product>(`/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
  }
