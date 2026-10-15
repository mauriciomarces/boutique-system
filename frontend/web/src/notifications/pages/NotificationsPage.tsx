import { useCallback, useEffect, useMemo, useState } from "react";

import AdministrationSidebar from "../../administration/components/AdministrationSidebar";
import LogoutButton from "../../auth/components/LogoutButton";
import {
  getNotifications,
  markNotificationAsRead,
} from "../services/notificationsApi";
import type { Notification } from "../services/notificationsApi";

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

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
    <div className="theme-bg min-h-screen">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdministrationSidebar
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

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
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => (
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
                          {item.mensaje}
                        </p>

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
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default NotificationsPage;