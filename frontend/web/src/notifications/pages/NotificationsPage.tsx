import { useCallback, useEffect, useMemo, useState } from "react";

import AdministrationLayout from "../../administration/components/AdministrationLayout";
import LogoutButton from "../../auth/components/LogoutButton";
import PaginationControls, {
  usePagination,
} from "../../components/PaginationControls";
import {
  getNotifications,
  markNotificationAsRead,
} from "../services/notificationsApi";
import type { Notification } from "../services/notificationsApi";
import { matchesLocalDateRange } from "../../utils/dateFilters";

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readableMessage(notification: Notification): string {
  const message = notification.mensaje;
  if (notification.tipo !== "ANOMALIA_DETECTADA") return message;

  const withoutReference = message
    .replace(/\s*Referencia del análisis:\s*[^\s.]+\./i, "")
    .trim();

  if (!message.includes("Clasificación CART:")) return withoutReference;

  const risk = message.match(/Nivel de riesgo:\s*([A-ZÁÉÍÓÚ]+)/i)?.[1];
  const eventCount = message.match(
    /Evidencia de eventos:\s*(\d+)\s+eventos relacionados/i,
  )?.[1];
  const signalLabels: Record<string, string> = {
    R1: "varios intentos fallidos de inicio de sesión",
    R2: "varias ventas anuladas",
    R3: "un movimiento de inventario relacionado con una venta",
    R5: "varias acciones administrativas",
  };
  const signals = Object.entries(signalLabels)
    .filter(([id]) => new RegExp(`(?:^|[;\\s])${id}: activada\\b`, "i").test(message))
    .map(([, label]) => label);
  const riskLabels: Record<string, string> = {
    ALTO: "alta",
    HIGH: "alta",
    MEDIO: "media",
    MEDIUM: "media",
    BAJO: "baja",
    LOW: "baja",
  };
  const riskLabel = risk ? riskLabels[risk.toUpperCase()] : undefined;

  return [
    "Se observó una actividad poco habitual que conviene revisar.",
    signals.length ? `Entre las señales observadas están: ${signals.join(", ")}.` : "",
    eventCount ? `Se revisaron ${eventCount} eventos relacionados.` : "",
    riskLabel ? `Prioridad de revisión: ${riskLabel}.` : "",
    "Esta alerta no demuestra fraude. Verifica si las acciones fueron esperadas.",
  ].filter(Boolean).join(" ");
}

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<"TODAS" | "NUEVAS" | "LEIDAS">("TODAS");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.leido_en).length,
    [notifications],
  );
  const visibleNotifications = useMemo(
    () => {
      const term = search.trim().toLocaleLowerCase("es");
      return notifications.filter((item) => {
        const searchable = `${item.titulo} ${item.mensaje} ${item.tipo}`
          .toLocaleLowerCase("es");
        return (
          (readFilter === "TODAS" ||
            (readFilter === "NUEVAS" ? !item.leido_en : Boolean(item.leido_en))) &&
          (!typeFilter || item.tipo === typeFilter) &&
          (!term || searchable.includes(term)) &&
          matchesLocalDateRange(item.creado_en, from, to)
        );
      });
    },
    [notifications, readFilter, search, typeFilter, from, to],
  );
  const notificationPagination = usePagination(visibleNotifications);

  const handleMarkAsRead = async (id: string) => {
    setMarkingId(id);
    setError("");
    setNotice("");

    try {
      const updated = await markNotificationAsRead(id);

      setNotifications((current) =>
        current.map((item) => item.id === updated.id ? updated : item),
      );

      setNotice("Notificación marcada como leída.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la notificación.",
      );
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <AdministrationLayout
      sidebarOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="mb-3 rounded-lg border theme-border px-3 py-2 text-sm theme-text lg:hidden"
              >
                Abrir menú
              </button>

              <p className="text-sm theme-text-muted">
                Administración
              </p>
              <h1 className="mt-1 text-3xl font-semibold theme-text">
                Notificaciones
              </h1>
              <p className="mt-2 theme-text-soft">
                Consulta los avisos asociados a tu cuenta.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border theme-border px-5 py-3">
                <p className="text-sm theme-text-muted">Pendientes de lectura</p>
                <p className="mt-1 text-2xl font-semibold theme-text">
                  {unreadCount}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              {notice}
            </div>
          )}

          <section className="rounded-2xl border theme-border bg-[var(--bg)] p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold theme-text">
                Historial personal
              </h2>

              <button
                type="button"
                onClick={() => void loadNotifications()}
                disabled={loading}
                className="rounded-xl border theme-border px-4 py-2 text-sm theme-text transition hover:bg-[var(--bg-secondary)] disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {([
                ["TODAS", "Todas"],
                ["NUEVAS", "No leídas"],
                ["LEIDAS", "Leídas"],
              ] as const).map(([value, label]) => {
                const count = value === "TODAS"
                  ? notifications.length
                  : value === "NUEVAS"
                    ? unreadCount
                    : notifications.length - unreadCount;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setReadFilter(value);
                      notificationPagination.setPage(1);
                    }}
                    aria-pressed={readFilter === value}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                      readFilter === value
                        ? "border-[var(--accent)] bg-[var(--bg-secondary)] theme-text"
                        : "theme-border theme-text-soft"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  notificationPagination.setPage(1);
                }}
                placeholder="Buscar en título y mensaje"
                aria-label="Buscar notificaciones"
                className="w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2 text-sm theme-text"
              />
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  notificationPagination.setPage(1);
                }}
                aria-label="Filtrar notificaciones por tipo"
                className="rounded-xl border theme-border bg-[var(--bg)] px-3 py-2 text-sm theme-text"
              >
                <option value="">Todos los tipos</option>
                {[...new Set(notifications.map((item) => item.tipo))]
                  .sort()
                  .map((type) => (
                    <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                  ))}
              </select>
              <label className="text-sm theme-text">
                Desde
                <input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    notificationPagination.setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2"
                />
              </label>
              <label className="text-sm theme-text">
                Hasta
                <input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    notificationPagination.setPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border theme-border bg-[var(--bg)] px-3 py-2"
                />
              </label>
            </div>

            <p className="mb-3 text-sm theme-text-muted">
              {visibleNotifications.length} de {notifications.length} notificaciones
            </p>

            {loading ? (
              <p className="py-10 text-center theme-text-soft">
                Cargando notificaciones...
              </p>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="font-medium theme-text">
                  No tienes notificaciones
                </h3>
                <p className="mt-2 text-sm theme-text-soft">
                  Los avisos asociados a tu cuenta aparecerán aquí.
                </p>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <p className="py-10 text-center text-sm theme-text-soft">
                No hay notificaciones en esta vista.
              </p>
            ) : (
              <>
              <div className="space-y-3">
                {notificationPagination.pageItems.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      item.leido_en
                        ? "theme-border"
                        : "border-[var(--accent)] bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold theme-text">
                            {item.titulo}
                          </h3>

                          {item.leido_en ? (
                            <span className="rounded-full border theme-border px-2 py-1 text-xs theme-text-muted">
                              Leída
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--accent)] px-2 py-1 text-xs text-white">
                              Nueva
                            </span>
                          )}
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 theme-text-soft">
                          {readableMessage(item)}
                        </p>

                        {item.tipo === "ANOMALIA_DETECTADA" && (
                          <p className="mt-3 text-xs font-medium text-amber-700">
                            Señal automatizada para revisión; no es una prueba de fraude.
                          </p>
                        )}

                        <p className="mt-3 text-xs theme-text-muted">
                          {formatDate(item.creado_en)}
                          {" · "}
                          {item.tipo.replaceAll("_", " ")}
                        </p>
                      </div>

                      {!item.leido_en && (
                        <button
                          type="button"
                          onClick={() => void handleMarkAsRead(item.id)}
                          disabled={markingId !== null}
                          className="shrink-0 rounded-xl border theme-border px-3 py-2 text-sm theme-text transition hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                        >
                          {markingId === item.id
                            ? "Guardando..."
                            : "Marcar como leída"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <PaginationControls
                page={notificationPagination.page}
                pageCount={notificationPagination.pageCount}
                pageSize={notificationPagination.pageSize}
                total={notificationPagination.total}
                onPageChange={notificationPagination.setPage}
                onPageSizeChange={notificationPagination.setPageSize}
              />
              </>
            )}
          </section>
        </main>
      </div>
    </AdministrationLayout>
  );
}

export default NotificationsPage;