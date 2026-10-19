import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import AdministrationSidebar from "../../administration/components/AdministrationSidebar";
import LogoutButton from "../../auth/components/LogoutButton";

import type {
  Product,
} from "../../products/types/products.types";

import type { Client } from "../../clients/types/clients.types";

import {
  getClients,
} from "../../clients/services/clientsApi";

import {
  getProducts,
} from "../../products/services/productsApi";

import {
  changeSaleStatus,
  createPayment,
  createSale,
  getPayments,
  getSale,
  getSaleCancellation,
  getSales,
  retrySaleCancellation,
} from "../services/salesApi";

import type {
  CancellationOperation,
  Payment,
  Sale,
  SaleCreateDetail,
} from "../types/sales.types";


interface CartItem extends SaleCreateDetail {
  key: string;
  productName: string;
  sku: string;
  talla: string;
  color: string;
}

function formatMoney(value: string | number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Bs 0.00";
  }

  return `Bs ${number.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getStatusClass(status: string) {
  if (status === "CONFIRMADA") {
    return "bg-[#e9f6ef] text-[#47745f]";
  }

  if (status === "ANULADA") {
    return "bg-[#f7e7e7] text-[#9c5c5c]";
  }

  return "bg-[#fff4dc] text-[#946f32]";
}

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [cancellationOperations, setCancellationOperations] =
    useState<Record<string, CancellationOperation>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [modal, setModal] = useState<
    "create" | "detail" | "payment" | null
  >(null);

  const [selectedSale, setSelectedSale] =
    useState<Sale | null>(null);

  const [clientId, setClientId] = useState("");
  const [selectedVariantId, setSelectedVariantId] =
    useState("");

  const [quantity, setQuantity] = useState("1");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [paymentMethod, setPaymentMethod] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [search, setSearch] = useState("");

  const [activeTab, setActiveTab] = useState<
    "ventas" | "pagos"
  >("ventas");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        salesData,
        paymentsData,
        clientsData,
        productsData,
      ] = await Promise.all([
        getSales(),
        getPayments(),
        getClients(""),
        getProducts(""),
      ]);

      setSales(salesData);
      setPayments(paymentsData);

      setClients(
        clientsData.filter(
          (client) => client.estado === "ACTIVO",
        ),
      );

      setProducts(
        productsData.filter(
          (product) =>
            product.estado === "ACTIVO",
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los datos de ventas.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const availableVariants = useMemo(() => {
    return products.flatMap((product) =>
      (product.variantes || [])
        .filter(
          (variant) =>
            variant.estado === "ACTIVO",
        )
        .map((variant) => ({
          product,
          variant,
        })),
    );
  }, [products]);

  const selectedVariant = useMemo(() => {
    return availableVariants.find(
      ({ variant }) =>
        variant.id === selectedVariantId,
    );
  }, [
    availableVariants,
    selectedVariantId,
  ]);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total +
        item.cantidad *
          Number(item.precio_unitario),
      0,
    );
  }, [cart]);

  const visibleSales = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    if (!term) {
      return sales;
    }

    return sales.filter((sale) => {
      const clientName = sale.clientes
        ? `${sale.clientes.nombre} ${sale.clientes.apellido}`
        : "";

      return (
        sale.id.includes(term) ||
        clientName.toLowerCase().includes(term) ||
        sale.estado
          .toLowerCase()
          .includes(term)
      );
    });
  }, [sales, search]);

  const openCreate = () => {
    setError("");
    setNotice("");
    setSelectedSale(null);
    setClientId("");
    setSelectedVariantId("");
    setQuantity("1");
    setCart([]);
    setModal("create");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelectedSale(null);
    setSelectedVariantId("");
    setQuantity("1");
    setPaymentMethod("");
    setPaymentAmount("");
    setCart([]);
  };

  const addToCart = () => {
    setError("");

    if (!selectedVariant) {
      setError(
        "Selecciona una variante de producto.",
      );
      return;
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setError(
        "La cantidad debe ser un número entero mayor que cero.",
      );
      return;
    }

    const existing = cart.find(
      (item) =>
        item.variante_producto_id ===
        selectedVariant.variant.id,
    );

    if (existing) {
      setCart(
        cart.map((item) =>
          item.variante_producto_id ===
          selectedVariant.variant.id
            ? {
                ...item,
                cantidad:
                  item.cantidad +
                  parsedQuantity,
              }
            : item,
        ),
      );
    } else {
      const variant =
        selectedVariant.variant;

      setCart([
        ...cart,
        {
          key: `${variant.id}-${Date.now()}`,
          variante_producto_id:
            variant.id,
          cantidad: parsedQuantity,
          precio_unitario: Number(
            variant.precio,
          ),
          productName:
            selectedVariant.product.nombre,
          sku: variant.sku,
          talla: variant.talla || "Sin talla",
          color: variant.color || "Sin color",
        },
      ]);
    }

    setSelectedVariantId("");
    setQuantity("1");
  };

  const removeFromCart = (key: string) => {
    setCart(
      cart.filter(
        (item) => item.key !== key,
      ),
    );
  };

  const updateCartQuantity = (
    key: string,
    value: string,
  ) => {
    const normalized = value
      .replace(/\D/g, "")
      .slice(0, 4);

    const parsed = Number(normalized);

    if (
      !normalized ||
      !Number.isInteger(parsed) ||
      parsed <= 0
    ) {
      return;
    }

    setCart(
      cart.map((item) =>
        item.key === key
          ? {
              ...item,
              cantidad: parsed,
            }
          : item,
      ),
    );
  };

  const handleCreateSale = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (cart.length === 0) {
      setError(
        "Agrega al menos un producto a la venta.",
      );
      return;
    }

    setSaving(true);

    try {
      const sale = await createSale({
        cliente_id: clientId,
        fecha_venta:
          new Date().toISOString(),
        detalles: cart.map((item) => ({
          variante_producto_id:
            item.variante_producto_id,
          cantidad: item.cantidad,
          precio_unitario:
            item.precio_unitario,
        })),
      });

      setSelectedSale(sale);

      setModal("payment");

      setPaymentAmount(
        Number(sale.total).toFixed(2),
      );

      setNotice(
        `Venta #${sale.id} creada correctamente. Registra el pago si corresponde.`,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar la venta.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedSale) {
      return;
    }

    const amount = Number(paymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "El monto del pago debe ser mayor que cero.",
      );
      return;
    }

    if (!paymentMethod.trim()) {
      setError(
        "Ingresa el método de pago.",
      );
      return;
    }

    setError("");
    setNotice("");
    setSaving(true);

    try {
      await createPayment({
        venta_id: selectedSale.id,
        metodo_pago: paymentMethod,
        monto: amount,
      });

      setNotice(
        `Pago registrado correctamente para la venta #${selectedSale.id}.`,
      );

      closeModal();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (
    sale: Sale,
  ) => {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const data = await getSale(sale.id);
      setSelectedSale(data);
      setModal("detail");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el detalle de la venta.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (
    sale: Sale,
  ) => {
    if (sale.estado !== "CONFIRMADA") {
      setError(
        "Solo se puede registrar un pago para una venta confirmada.",
      );
      return;
    }

    const paid = sale.pagos
      .filter(
        (payment) =>
          payment.estado === "PAGADO" ||
          payment.estado === "PENDIENTE",
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.monto),
        0,
      );

    const remaining = Math.max(
      Number(sale.total) - paid,
      0,
    );

    if (remaining <= 0) {
      setError(
        "La venta ya tiene el total pagado.",
      );
      return;
    }

    setError("");
    setNotice("");
    setSelectedSale(sale);
    setPaymentMethod("");
    setPaymentAmount(
      remaining.toFixed(2),
    );
    setModal("payment");
  };

  const handleCancelSale = async (
    sale: Sale,
  ) => {
    if (sale.estado === "ANULADA") {
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas anular la venta #${sale.id}? Esta operación afectará el inventario.`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    setSaving(true);

    try {
      const result = await changeSaleStatus(
        sale.id,
        "ANULADA",
      );

      setCancellationOperations((current) => ({
        ...current,
        [sale.id]: result.anulacion,
      }));
      setNotice(result.anulacion.estado === "COMPLETADA"
        ? `Venta #${sale.id} anulada correctamente.`
        : `La anulación de la venta #${sale.id} sigue en estado ${result.anulacion.estado}. Puedes consultar el estado o reintentarla.`);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo anular la venta.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshCancellation = async (sale: Sale) => {
    setError("");
    setNotice("");

    try {
      const operation = await getSaleCancellation(sale.id);
      setCancellationOperations((current) => ({
        ...current,
        [sale.id]: operation,
      }));
      setNotice(
        `Anulación de la venta #${sale.id}: ${operation.estado}` +
          (operation.ultimo_error ? ` — ${operation.ultimo_error}` : ""),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo consultar el estado de la anulación.",
      );
    }
  };

  const handleRetryCancellation = async (sale: Sale) => {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const operation = await retrySaleCancellation(sale.id);
      setCancellationOperations((current) => ({
        ...current,
        [sale.id]: operation,
      }));
      setNotice(operation.estado === "COMPLETADA"
        ? `Venta #${sale.id} anulada correctamente.`
        : `La anulación de la venta #${sale.id} sigue en estado ${operation.estado}.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo reintentar la anulación.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="theme-bg min-h-screen">
      <header className="border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border theme-border bg-[var(--bg)] theme-text shadow-lg lg:hidden"
              aria-label="Abrir menú de administración"
              aria-expanded={sidebarOpen}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <Link
              to="/"
              className="theme-text"
            >
              <p className="text-sm font-semibold tracking-[0.08em]">
                BOUTIQUE SPOSABELLA
              </p>

              <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
                Centro de gestión
              </p>
            </Link>
          </div>

          <div className="flex items-center gap-3">
          <Link
            to="/administracion"
            className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
          >
            Administración
          </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdministrationSidebar
          sidebarOpen={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
                Gestión comercial
              </p>

              <h1 className="mt-2 text-3xl font-semibold theme-text">
                Ventas y transacciones
              </h1>

              <p className="mt-2 theme-text-soft">
                Registra ventas, administra sus
                pagos y controla las transacciones
                realizadas.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
            >
              + Nueva venta
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 text-lg font-semibold leading-none text-red-500"
                aria-label="Cerrar mensaje de error"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                className="shrink-0 text-lg font-semibold leading-none text-green-600"
                aria-label="Cerrar mensaje"
              >
                ×
              </button>
            </div>
          )}

          <section className="glass soft-shadow overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-4 border-b theme-border p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab("ventas")
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    activeTab === "ventas"
                      ? "bg-[var(--bg-secondary)] theme-text"
                      : "theme-text-soft"
                  }`}
                >
                  Ventas
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab("pagos")
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    activeTab === "pagos"
                      ? "bg-[var(--bg-secondary)] theme-text"
                      : "theme-text-soft"
                  }`}
                >
                  Transacciones
                </button>
              </div>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={
                  activeTab === "ventas"
                    ? "Buscar venta o cliente"
                    : "Buscar transacción"
                }
                className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm theme-text lg:w-80"
              />
            </div>

            {loading ? (
              <div className="p-8 text-sm theme-text-soft">
                Cargando información...
              </div>
            ) : activeTab === "ventas" ? (
              visibleSales.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-medium theme-text">
                    No se encontraron ventas
                  </p>

                  <p className="mt-2 text-sm theme-text-soft">
                    Registra una nueva venta para
                    comenzar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                      <tr>
                        <th className="px-5 py-4 font-medium">
                          Venta
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Cliente
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Fecha
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Total
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Estado
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleSales.map(
                        (sale) => (
                          <tr
                            key={sale.id}
                            className="border-t theme-border"
                          >
                            <td className="px-5 py-4">
                              <p className="font-medium theme-text">
                                Venta #{sale.id}
                              </p>

                              <p className="mt-1 text-xs theme-text-muted">
                                {sale.detalle_ventas
                                  ?.length || 0}{" "}
                                detalle(s)
                              </p>
                            </td>

                            <td className="px-5 py-4 theme-text-soft">
                              {sale.clientes
                                ? `${sale.clientes.nombre} ${sale.clientes.apellido}`
                                : "Venta sin cliente"}
                            </td>

                            <td className="px-5 py-4 theme-text-soft">
                              {formatDate(
                                sale.fecha_venta,
                              )}
                            </td>

                            <td className="px-5 py-4 font-medium theme-text">
                              {formatMoney(
                                sale.total,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                                  sale.estado,
                                )}`}
                              >
                                {sale.estado}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void openDetail(sale)}
                                  className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text"
                                >
                                  Ver
                                </button>

                                {sale.estado === "ANULADA" && (
                                  <button
                                    type="button"
                                    onClick={() => void handleRefreshCancellation(sale)}
                                    className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text"
                                  >
                                    Estado de anulación
                                  </button>
                                )}

                                {sale.estado === "ANULADA" &&
                                  cancellationOperations[sale.id] &&
                                  cancellationOperations[sale.id].estado !== "COMPLETADA" && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRetryCancellation(sale)}
                                      disabled={saving}
                                      className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text disabled:opacity-50"
                                    >
                                      Reintentar anulación
                                    </button>
                                  )}

                                {sale.estado === "CONFIRMADA" &&
                                  Number(sale.total) -
                                    sale.pagos
                                      .filter((payment) =>
                                        payment.estado === "PAGADO" ||
                                        payment.estado === "PENDIENTE"
                                      )
                                      .reduce((sum, payment) => sum + Number(payment.monto), 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openPayment(sale)}
                                      className="rounded-lg border border-[#6cad91] px-3 py-1.5 text-xs font-semibold text-[#47745f]"
                                    >
                                      Pago
                                    </button>
                                  )}

                                {sale.estado === "CONFIRMADA" &&
                                  !sale.pagos.some((payment) =>
                                    payment.estado === "PAGADO" ||
                                    payment.estado === "PENDIENTE"
                                  ) && (
                                    <button
                                      type="button"
                                      onClick={() => void handleCancelSale(sale)}
                                      disabled={saving}
                                      className="rounded-lg border border-[#d49a9a] px-3 py-1.5 text-xs font-semibold text-[#9c5c5c] disabled:opacity-50"
                                    >
                                      Anular
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              payments.filter((payment) => {
                const term =
                  search.trim().toLowerCase();

                if (!term) {
                  return true;
                }

                return (
                  payment.id.includes(term) ||
                  payment.venta_id.includes(
                    term,
                  ) ||
                  payment.metodo_pago
                    .toLowerCase()
                    .includes(term) ||
                  payment.estado
                    .toLowerCase()
                    .includes(term)
                );
              }).length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-medium theme-text">
                    No se encontraron transacciones
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                      <tr>
                        <th className="px-5 py-4 font-medium">
                          Transacción
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Venta
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Método
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Monto
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Estado
                        </th>

                        <th className="px-5 py-4 font-medium">
                          Fecha
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payments
                        .filter((payment) => {
                          const term =
                            search
                              .trim()
                              .toLowerCase();

                          if (!term) {
                            return true;
                          }

                          return (
                            payment.id.includes(
                              term,
                            ) ||
                            payment.venta_id.includes(
                              term,
                            ) ||
                            payment.metodo_pago
                              .toLowerCase()
                              .includes(
                                term,
                              ) ||
                            payment.estado
                              .toLowerCase()
                              .includes(
                                term,
                              )
                          );
                        })
                        .map(
                          (payment) => (
                            <tr
                              key={payment.id}
                              className="border-t theme-border"
                            >
                              <td className="px-5 py-4 font-medium theme-text">
                                #{payment.id}
                              </td>

                              <td className="px-5 py-4 theme-text-soft">
                                Venta #
                                {
                                  payment.venta_id
                                }
                              </td>

                              <td className="px-5 py-4 theme-text-soft">
                                {
                                  payment.metodo_pago
                                }
                              </td>

                              <td className="px-5 py-4 font-medium theme-text">
                                {formatMoney(
                                  payment.monto,
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                                    payment.estado ===
                                      "PAGADO"
                                      ? "CONFIRMADA"
                                      : payment.estado ===
                                        "ANULADO"
                                      ? "ANULADA"
                                      : "PENDIENTE",
                                  )}`}
                                >
                                  {
                                    payment.estado
                                  }
                                </span>
                              </td>

                              <td className="px-5 py-4 theme-text-soft">
                                {formatDate(
                                  payment.fecha_pago,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        </main>
      </div>

      {modal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleCreateSale}
            className="my-8 w-full max-w-4xl rounded-2xl border theme-border bg-[var(--bg)] p-6 shadow-2xl"
            noValidate
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  Nueva venta
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  Selecciona los productos y
                  cantidades que componen la venta.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl theme-text-muted"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="sale-client"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Cliente
                </label>

                <select
                  id="sale-client"
                  value={clientId}
                  onChange={(event) =>
                    setClientId(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                >
                  <option value="">
                    Venta sin cliente
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.nombre}{" "}
                      {client.apellido}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sale-variant"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Producto / variante
                </label>

                <select
                  id="sale-variant"
                  value={selectedVariantId}
                  onChange={(event) =>
                    setSelectedVariantId(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                >
                  <option value="">
                    Selecciona una variante
                  </option>

                  {availableVariants.map(
                    ({ product, variant }) => (
                      <option
                        key={variant.id}
                        value={variant.id}
                      >
                        {product.nombre} ·{" "}
                        {variant.sku} ·{" "}
                        {variant.talla ||
                          "Sin talla"}{" "}
                        ·{" "}
                        {variant.color ||
                          "Sin color"} ·{" "}
                        {formatMoney(
                          variant.precio,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {selectedVariant && (
              <div className="mt-4 rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium theme-text">
                      {
                        selectedVariant.product
                          .nombre
                      }
                    </p>

                    <p className="mt-1 text-xs theme-text-muted">
                      SKU{" "}
                      {
                        selectedVariant.variant
                          .sku
                      }{" "}
                      · Talla{" "}
                      {
                        selectedVariant.variant
                          .talla ||
                          "Sin talla"
                      }{" "}
                      · Color{" "}
                      {
                        selectedVariant.variant
                          .color ||
                          "Sin color"
                      }
                    </p>

                    <p className="mt-2 text-sm theme-text-soft">
                      Precio:{" "}
                      <span className="font-semibold theme-text">
                        {formatMoney(
                          selectedVariant
                            .variant.precio,
                        )}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-end gap-2">
                    <div>
                      <label
                        htmlFor="sale-quantity"
                        className="mb-1.5 block text-xs font-medium theme-text"
                      >
                        Cantidad
                      </label>

                      <input
                        id="sale-quantity"
                        value={quantity}
                        inputMode="numeric"
                        maxLength={4}
                        onChange={(event) =>
                          setQuantity(
                            event.target.value
                              .replace(
                                /\D/g,
                                "",
                              )
                              .slice(0, 4),
                          )
                        }
                        className="w-24 rounded-xl border theme-border bg-[var(--bg)] px-4 py-3 text-sm theme-text"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={addToCart}
                      className="theme-button-dark rounded-xl px-4 py-3 text-sm font-semibold"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 overflow-x-auto rounded-xl border theme-border">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-sm theme-text-soft">
                  No hay productos agregados a la
                  venta.
                </div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        Producto
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Variante
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Cantidad
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Precio
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Subtotal
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Acción
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map((item) => (
                      <tr
                        key={item.key}
                        className="border-t theme-border"
                      >
                        <td className="px-4 py-3 font-medium theme-text">
                          {item.productName}
                        </td>

                        <td className="px-4 py-3 theme-text-soft">
                          {item.sku} ·{" "}
                          {item.talla} ·{" "}
                          {item.color}
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={String(
                              item.cantidad,
                            )}
                            inputMode="numeric"
                            maxLength={4}
                            onChange={(event) =>
                              updateCartQuantity(
                                item.key,
                                event.target
                                  .value,
                              )
                            }
                            className="w-20 rounded-lg border theme-border bg-[var(--bg-secondary)] px-3 py-2 text-sm theme-text"
                          />
                        </td>

                        <td className="px-4 py-3 theme-text-soft">
                          {formatMoney(
                            item.precio_unitario,
                          )}
                        </td>

                        <td className="px-4 py-3 font-medium theme-text">
                          {formatMoney(
                            item.cantidad *
                              Number(
                                item.precio_unitario,
                              ),
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(
                                item.key,
                              )
                            }
                            className="rounded-lg border border-[#d49a9a] px-3 py-1.5 text-xs font-semibold text-[#9c5c5c]"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-5 flex flex-col items-end gap-1">
              <p className="text-sm theme-text-soft">
                Subtotal
              </p>

              <p className="text-2xl font-semibold theme-text">
                {formatMoney(cartTotal)}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border theme-border px-4 py-3 text-sm theme-text disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  saving || cart.length === 0
                }
                className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {saving
                  ? "Registrando..."
                  : "Registrar venta"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === "payment" &&
        selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
              onSubmit={handleCreatePayment}
              className="w-full max-w-lg rounded-2xl border theme-border bg-[var(--bg)] p-6 shadow-2xl"
              noValidate
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold theme-text">
                    Registrar pago
                  </h2>

                  <p className="mt-1 text-sm theme-text-soft">
                    Venta #{selectedSale.id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="text-2xl theme-text-muted disabled:opacity-40"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
                <div className="flex justify-between text-sm">
                  <span className="theme-text-soft">
                    Total de la venta
                  </span>

                  <span className="font-semibold theme-text">
                    {formatMoney(
                      selectedSale.total,
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="payment-method"
                    className="mb-1.5 block text-sm font-medium theme-text"
                  >
                    Método de pago
                  </label>

                  <select
                    id="payment-method"
                    required
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                  >
                    <option value="">Selecciona un método</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="QR">QR</option>
                    <option value="TRANSFERENCIA">Transferencia bancaria</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>

                  <p className="mt-1 text-xs theme-text-muted">
                    Se normalizará automáticamente
                    a mayúsculas.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="payment-amount"
                    className="mb-1.5 block text-sm font-medium theme-text"
                  >
                    Monto
                  </label>

                  <input
                    id="payment-amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) =>
                      setPaymentAmount(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border theme-border px-4 py-3 text-sm theme-text disabled:opacity-40"
                >
                  Omitir por ahora
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {saving
                    ? "Registrando..."
                    : "Registrar pago"}
                </button>
              </div>
            </form>
          </div>
        )}

      {modal === "detail" &&
        selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
            <div className="my-8 w-full max-w-3xl rounded-2xl border theme-border bg-[var(--bg)] p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold theme-text">
                    Venta #{selectedSale.id}
                  </h2>

                  <p className="mt-1 text-sm theme-text-soft">
                    {formatDate(
                      selectedSale.fecha_venta,
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-2xl theme-text-muted"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs theme-text-muted">
                    Cliente
                  </p>

                  <p className="mt-1 font-medium theme-text">
                    {selectedSale.clientes
                      ? `${selectedSale.clientes.nombre} ${selectedSale.clientes.apellido}`
                      : "Sin cliente"}
                  </p>
                </div>

                <div className="rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs theme-text-muted">
                    Estado
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                      selectedSale.estado,
                    )}`}
                  >
                    {selectedSale.estado}
                  </span>
                </div>

                <div className="rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs theme-text-muted">
                    Total
                  </p>

                  <p className="mt-1 text-lg font-semibold theme-text">
                    {formatMoney(
                      selectedSale.total,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border theme-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        Variante
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Cantidad
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Precio
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedSale.detalle_ventas.map(
                      (detail) => (
                        <tr
                          key={detail.id}
                          className="border-t theme-border"
                        >
                          <td className="px-4 py-3 theme-text">
                            #{detail.variante_producto_id}
                          </td>

                          <td className="px-4 py-3 theme-text-soft">
                            {detail.cantidad}
                          </td>

                          <td className="px-4 py-3 theme-text-soft">
                            {formatMoney(
                              detail.precio_unitario,
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium theme-text">
                            {formatMoney(
                              detail.subtotal,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5">
                <h3 className="font-semibold theme-text">
                  Pagos
                </h3>

                {selectedSale.pagos.length ===
                0 ? (
                  <p className="mt-2 text-sm theme-text-soft">
                    No existen pagos registrados.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedSale.pagos.map(
                      (payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border theme-border bg-[var(--bg-secondary)] p-4 sm:flex-row"
                        >
                          <div>
                            <p className="font-medium theme-text">
                              {
                                payment.metodo_pago
                              }
                            </p>

                            <p className="mt-1 text-xs theme-text-muted">
                              {formatDate(
                                payment.fecha_pago,
                              )}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="font-semibold theme-text">
                              {formatMoney(
                                payment.monto,
                              )}
                            </p>

                            <p className="mt-1 text-xs theme-text-muted">
                              {payment.estado}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border theme-border px-4 py-3 text-sm theme-text"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default SalesPage;
