
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearAuthSession,
  endSession,
  getAccessToken,
  getTokenExpiration,
  renewSession,
} from "../services/session";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = "sposabella_last_activity";
const ACTIVITY_THROTTLE_MS = 1000;

const PRIVATE_PATHS = [
  "/cuenta",
  "/admin/usuarios",
  "/administracion",
  "/analisis",
];

function isPrivatePath(path: string) {
  return PRIVATE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export default function SessionMonitor() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPrivatePath(location.pathname)) return;

    let disposed = false;
    let loggingOut = false;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastPersistedAt = 0;

    function readLastActivity(): number {
      const value = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (value === null) return 0;

      const timestamp = Number(value);
      return Number.isFinite(timestamp) && timestamp > 0
        ? timestamp
        : 0;
    }

    function isIdle(): boolean {
      const lastActivity = readLastActivity();

      return (
        lastActivity === 0 ||
        Date.now() - lastActivity >= IDLE_TIMEOUT_MS
      );
    }

    function forceLogout() {
      if (loggingOut || disposed) return;

      loggingOut = true;

      if (idleTimeout !== undefined) clearTimeout(idleTimeout);
      if (refreshTimeout !== undefined) clearTimeout(refreshTimeout);

      // Inicia el cierre remoto antes de limpiar el token de renovación.
      const logoutRequest = endSession();

      localStorage.removeItem(LAST_ACTIVITY_KEY);
      clearAuthSession();
      navigate("/login", { replace: true });

      void logoutRequest;
    }

    function scheduleIdleCheck() {
      if (disposed || loggingOut) return;

      if (idleTimeout !== undefined) clearTimeout(idleTimeout);

      const lastActivity = readLastActivity();

      if (lastActivity === 0) {
        forceLogout();
        return;
      }

      const remaining =
        IDLE_TIMEOUT_MS - (Date.now() - lastActivity);

      if (remaining <= 0) {
        forceLogout();
        return;
      }

      idleTimeout = setTimeout(
        scheduleIdleCheck,
        remaining,
      );
    }

    function recordActivity() {
      if (disposed || loggingOut) return;

      // No permite que una interacción posterior a los 15 minutos
      // reactive una sesión que ya debía haberse cerrado.
      if (isIdle()) {
        forceLogout();
        return;
      }

      const now = Date.now();

      if (now - lastPersistedAt < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastPersistedAt = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      scheduleIdleCheck();
    }

    async function refreshIfActive() {
      if (disposed || loggingOut) return;

      if (isIdle()) {
        forceLogout();
        return;
      }

      try {
        await renewSession();

        if (!disposed && !loggingOut) {
          scheduleRefresh();
        }
      } catch {
        forceLogout();
      }
    }

    function scheduleRefresh() {
      if (disposed || loggingOut) return;

      if (refreshTimeout !== undefined) {
        clearTimeout(refreshTimeout);
      }

      const token = getAccessToken();

      if (!token) {
        forceLogout();
        return;
      }

      const expiration = getTokenExpiration(token);

      if (expiration === null) {
        void refreshIfActive();
        return;
      }

      const delay = expiration - Date.now() - 60_000;

      if (delay <= 0) {
        void refreshIfActive();
        return;
      }

      refreshTimeout = setTimeout(
        () => void refreshIfActive(),
        delay,
      );
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== LAST_ACTIVITY_KEY) return;

      // La eliminación de esta clave señala el cierre de sesión
      // iniciado desde otra pestaña.
      if (event.newValue === null) {
        forceLogout();
        return;
      }

      scheduleIdleCheck();
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      if (isIdle()) {
        forceLogout();
        return;
      }

      scheduleIdleCheck();
      scheduleRefresh();
    }

    // Una sesión anterior a esta implementación no tendrá esta clave.
    // En ese caso, se inicia el seguimiento desde ahora.
    if (localStorage.getItem(LAST_ACTIVITY_KEY) === null) {
      const now = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastPersistedAt = now;
    } else {
      lastPersistedAt = readLastActivity();
    }

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, {
        passive: true,
      });
    });

    window.addEventListener("storage", handleStorage);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    scheduleIdleCheck();
    scheduleRefresh();

    return () => {
      disposed = true;

      if (idleTimeout !== undefined) clearTimeout(idleTimeout);
      if (refreshTimeout !== undefined) clearTimeout(refreshTimeout);

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });

      window.removeEventListener("storage", handleStorage);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [location.pathname, navigate]);

  return null;
}
