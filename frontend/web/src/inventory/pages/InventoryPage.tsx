import { useCallback, useEffect, useMemo, useState } from "react";

import AdministrationLayout from "../../administration/components/AdministrationLayout";
import LogoutButton from "../../auth/components/LogoutButton";
import PaginationControls, {
  usePagination,
} from "../../components/PaginationControls";

import { getProducts } from "../../products/services/productsApi";
import type { Product, ProductVariant } from "../../products/types/products.types";

import {
  getInventory,
  getInventoryMovements,
} from "../services/inventoryApi";

import type {
  InventoryItem,
  InventoryMovement,
} from "../types/inventory.types";
import { matchesLocalDateRange } from "../../utils/dateFilters";

function asNumber(value: number | string | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value?: string | null): string {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getVariantLabel(
  variantId: string | number,
  variants: Map<string, { product: Product; variant: ProductVariant }>,
): string {
  const match = variants.get(String(variantId));

  if (!match) return `Variante #${variantId}`;

  const parts = [
    match.product.nombre,
    match.variant.talla ? `Talla ${match.variant.talla}` : "",
    match.variant.color || "",
  ].filter(Boolean);

  return parts.join(" · ");
}

function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<"TODOS" | "BAJO" | "DISPONIBLE">("TODOS");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [inventoryData, movementData, productData] = await Promise.all([
        getInventory(),
        getInventoryMovements(),
        getProducts(),
      ]);

      setItems(inventoryData);
      setMovements(movementData);
      setProducts(productData);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la informaci\u00F3n del inventario.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const variantMap = useMemo(() => {
    const map = new Map<
      string,
      { product: Product; variant: ProductVariant }
    >();

    for (const product of products) {
      for (const variant of product.variantes ?? []) {
        map.set(String(variant.id), { product, variant });
      }
    }

    return map;
  }, [products]);

  const lowStockCount = useMemo(
    () =>
      items.filter(
        (item) => asNumber(item.cantidad) <= asNumber(item.cantidad_minima),
      ).length,
    [items],
  );

  const totalUnits = useMemo(
    () => items.reduce((total, item) => total + asNumber(item.cantidad), 0),
    [items],
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");

    return items.filter((item) => {
      const isLow =
        asNumber(item.cantidad) <= asNumber(item.cantidad_minima);

      if (stockStatus === "BAJO" && !isLow) return false;
      if (stockStatus === "DISPONIBLE" && isLow) return false;
      if (!term) return true;

      const variant = variantMap.get(String(item.variante_producto_id));

      const searchable = [
        item.id,
        item.variante_producto_id,
        variant?.product.nombre,
        variant?.variant.sku,
        variant?.variant.talla,
        variant?.variant.color,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");

      return searchable.includes(term);
    });
  }, [items, stockStatus, search, variantMap]);
  const filteredMovements = useMemo(() => {
    const term = movementSearch.trim().toLocaleLowerCase("es");

    return movements.filter((movement) => {
      const variant = variantMap.get(String(movement.variante_producto_id));
      const date = movement.creado_en || movement.created_at;
      const searchable = [
        movement.id,
        movement.tipo_movimiento,
        movement.referencia_tipo,
        movement.referencia_id,
        movement.motivo,
        getVariantLabel(movement.variante_producto_id, variantMap),
        variant?.variant.sku,
      ].filter(Boolean).join(" ").toLocaleLowerCase("es");

      return (
        (!term || searchable.includes(term)) &&
        (!movementType || movement.tipo_movimiento === movementType) &&
        matchesLocalDateRange(date, movementFrom, movementTo)
      );
    });
  }, [movements, movementSearch, movementType, movementFrom, movementTo, variantMap]);
  const inventoryPagination = usePagination(filteredItems);
  const movementPagination = usePagination(filteredMovements);

  return (
    <AdministrationLayout
      sidebarOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    >
      <main className="mx-auto min-h-screen w-full max-w-[1600px] min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border theme-border px-3 py-2 theme-text lg:hidden"
                aria-label="Abrir menú"
              >
                ☰
              </button>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">
                  Administración
                </p>
                <h1 className="text-2xl font-semibold theme-text sm:text-3xl">
                  Inventario
                </h1>
                <p className="mt-2 text-sm theme-text-soft">
                  Existencias disponibles y registro de movimientos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LogoutButton />
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="rounded-xl border theme-border px-4 py-2.5 text-sm font-medium theme-text transition hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
            >
              <p className="font-semibold">No se pudo cargar el inventario.</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void loadData()}
                className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-medium"
              >
                Reintentar
              </button>
            </div>
          )}

          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="glass soft-shadow rounded-2xl border theme-border p-5">
              <p className="text-sm theme-text-soft">Variantes con registro</p>
              <p className="mt-2 text-3xl font-semibold theme-text">
                {items.length}
              </p>
            </article>

            <article className="glass soft-shadow rounded-2xl border theme-border p-5">
              <p className="text-sm theme-text-soft">Unidades registradas</p>
              <p className="mt-2 text-3xl font-semibold theme-text">
                {totalUnits}
              </p>
            </article>

            <article className="glass soft-shadow rounded-2xl border theme-border p-5">
              <p className="text-sm theme-text-soft">Registros con stock bajo</p>
              <p className="mt-2 text-3xl font-semibold text-amber-600">
                {lowStockCount}
              </p>
            </article>
          </section>

          <section className="glass soft-shadow mb-6 rounded-2xl border theme-border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold theme-text">Existencias</h2>
              <select
                value={stockStatus}
                onChange={(event) => {
                    setStockStatus(event.target.value as typeof stockStatus);
                    inventoryPagination.setPage(1);
                  }}
                aria-label="Filtrar existencias por nivel de stock"
                className="rounded-xl border theme-border bg-[var(--bg)] px-3 py-2 text-sm theme-text"
              >
                <option value="TODOS">Todos los niveles</option>
                <option value="BAJO">Stock bajo</option>
                <option value="DISPONIBLE">Disponible</option>
              </select>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                inventoryPagination.setPage(1);
              }}
              placeholder="Buscar por producto, SKU, talla o color..."
              className="mb-4 w-full rounded-xl border theme-border bg-[var(--bg)] px-4 py-3 text-sm theme-text outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            {loading && items.length === 0 ? (
              <p className="py-10 text-center text-sm theme-text-soft">
                Cargando existencias...
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b theme-border theme-text-soft">
                      <th className="px-3 py-3 font-medium">Producto / variante</th>
                      <th className="px-3 py-3 font-medium">SKU</th>
                      <th className="px-3 py-3 font-medium">Cantidad</th>
                      <th className="px-3 py-3 font-medium">Mínimo</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3 font-medium">Actualizado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {inventoryPagination.pageItems.map((item) => {
                      const low =
                        asNumber(item.cantidad) <= asNumber(item.cantidad_minima);
                      const variant = variantMap.get(
                        String(item.variante_producto_id),
                      );

                      return (
                        <tr
                          key={String(item.id)}
                          className="border-b theme-border last:border-b-0"
                        >
                          <td className="px-3 py-4 theme-text">
                            <div className="font-medium">
                              {getVariantLabel(item.variante_producto_id, variantMap)}
                            </div>
                            <div className="mt-1 text-xs theme-text-muted">
                              Variante #{item.variante_producto_id}
                            </div>
                          </td>
                          <td className="px-3 py-4 theme-text-soft">
                            {variant?.variant.sku || "Sin SKU"}
                          </td>
                          <td className="px-3 py-4 font-semibold theme-text">
                            {asNumber(item.cantidad)}
                          </td>
                          <td className="px-3 py-4 theme-text-soft">
                            {asNumber(item.cantidad_minima)}
                          </td>
                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                low
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {low ? "Stock bajo" : "Disponible"}
                            </span>
                          </td>
                          <td className="px-3 py-4 theme-text-soft">
                            {formatDate(item.actualizado_en)}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-10 text-center theme-text-soft"
                        >
                          {loading
                            ? "Cargando..."
                            : "No se encontraron existencias con esos filtros."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-xs theme-text-muted">
              Mostrando {filteredItems.length} de {items.length} registros.
              {" "}
              {lastUpdated
                ? `\u00DAltima actualizaci\u00F3n: ${formatDate(lastUpdated)}`
                : ""}
            </p>
            <PaginationControls
              page={inventoryPagination.page}
              pageCount={inventoryPagination.pageCount}
              pageSize={inventoryPagination.pageSize}
              total={inventoryPagination.total}
              onPageChange={inventoryPagination.setPage}
              onPageSizeChange={inventoryPagination.setPageSize}
            />
          </section>

          <section className="glass soft-shadow rounded-2xl border theme-border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold theme-text">
                Historial de movimientos
              </h2>
              <span className="text-xs theme-text-muted">
                {filteredMovements.length} de {movements.length} registros
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={movementSearch}
                onChange={(event) => {
                  setMovementSearch(event.target.value);
                  movementPagination.setPage(1);
                }}
                placeholder="Buscar producto, referencia o motivo"
                aria-label="Buscar movimientos de inventario"
                className="w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2 text-sm theme-text"
              />
              <select
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value);
                  movementPagination.setPage(1);
                }}
                aria-label="Filtrar movimientos por tipo"
                className="rounded-xl border theme-border bg-[var(--bg)] px-3 py-2 text-sm theme-text"
              >
                <option value="">Todos los tipos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
              <label className="text-sm theme-text">
                Desde
                <input
                  type="date"
                  value={movementFrom}
                  onChange={(event) => {
                    setMovementFrom(event.target.value);
                    movementPagination.setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2"
                />
              </label>
              <label className="text-sm theme-text">
                Hasta
                <input
                  type="date"
                  value={movementTo}
                  onChange={(event) => {
                    setMovementTo(event.target.value);
                    movementPagination.setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2"
                />
              </label>
            </div>

            {loading && movements.length === 0 ? (
              <p className="py-8 text-center text-sm theme-text-soft">
                Cargando movimientos...
              </p>
            ) : movements.length === 0 ? (
              <p className="py-8 text-center text-sm theme-text-soft">
                No hay movimientos registrados.
              </p>
            ) : filteredMovements.length === 0 ? (
              <p className="py-8 text-center text-sm theme-text-soft">
                No hay movimientos que coincidan con los filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b theme-border theme-text-soft">
                      <th className="px-3 py-3 font-medium">Fecha</th>
                      <th className="px-3 py-3 font-medium">Tipo</th>
                      <th className="px-3 py-3 font-medium">Producto / variante</th>
                      <th className="px-3 py-3 font-medium">Cantidad</th>
                      <th className="px-3 py-3 font-medium">Referencia</th>
                      <th className="px-3 py-3 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementPagination.pageItems.map((movement) => (
                      <tr
                        key={String(movement.id)}
                        className="border-b theme-border last:border-b-0"
                      >
                        <td className="px-3 py-4 theme-text-soft">
                          {formatDate(movement.creado_en || movement.created_at)}
                        </td>
                        <td className="px-3 py-4">
                          <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium theme-text">
                            {movement.tipo_movimiento}
                          </span>
                        </td>
                        <td className="px-3 py-4 theme-text">
                          {getVariantLabel(movement.variante_producto_id, variantMap)}
                        </td>
                        <td className="px-3 py-4 font-medium theme-text">
                          {asNumber(movement.cantidad)}
                        </td>
                        <td className="px-3 py-4 theme-text-soft">
                          {movement.referencia_tipo
                            ? `${movement.referencia_tipo}${movement.referencia_id != null ? ` #${movement.referencia_id}` : ""}`
                            : "Sin referencia"}
                        </td>
                        <td className="px-3 py-4 theme-text-soft">
                          {movement.motivo || "Sin motivo"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {movements.length > 0 && (
              <PaginationControls
                page={movementPagination.page}
                pageCount={movementPagination.pageCount}
                pageSize={movementPagination.pageSize}
                total={movementPagination.total}
                onPageChange={movementPagination.setPage}
                onPageSizeChange={movementPagination.setPageSize}
              />
            )}
          </section>
      </main>
    </AdministrationLayout>
  );
}

export default InventoryPage;