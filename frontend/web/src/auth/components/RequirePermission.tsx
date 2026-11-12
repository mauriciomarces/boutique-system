import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import ErrorPage from "../../components/ErrorPage";
import {
  clearPermissionsCache,
  fetchCurrentUserAccess,
  fetchEffectivePermissions,
  PermissionsError,
} from "../services/permissions";
import { clearAuthSession } from "../services/session";

type Outcome = "allowed" | "denied" | "unauthenticated" | "error";

type RequirePermissionProps = {
  permission: string;
  allowedRoles?: string[];
  children: ReactNode;
};

/**
 * Protege una ruta por permiso. Debe usarse dentro de RequireAuth.
 * - Sin sesión válida (401/403 del servicio de usuarios): redirige a /login.
 * - Con sesión pero sin el permiso: muestra la página 403.
 * El resultado se asocia a la ruta que lo generó, así nunca se reutiliza
 * una decisión de otra ruta mientras se verifica la nueva.
 */
export default function RequirePermission({
  permission,
  allowedRoles,
  children,
}: RequirePermissionProps) {
  const location = useLocation();
  const [sessionRevision, setSessionRevision] = useState(0);
  const requestKey = `${permission}|${location.pathname}|${sessionRevision}`;
  const [result, setResult] = useState<{ key: string; outcome: Outcome } | null>(
    null,
  );

  useEffect(() => {
    const handleSessionChange = () => {
      setSessionRevision((revision) => revision + 1);
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === "sposabella_access_token" ||
        event.key === "sposabella_user" ||
        event.key === null
      ) {
        handleSessionChange();
      }
    };

    window.addEventListener(
      "sposabella:auth-session-changed",
      handleSessionChange,
    );
    window.addEventListener(
      "sposabella:permissions-updated",
      handleSessionChange,
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        "sposabella:auth-session-changed",
        handleSessionChange,
      );
      window.removeEventListener(
        "sposabella:permissions-updated",
        handleSessionChange,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchEffectivePermissions(), fetchCurrentUserAccess()])
      .then(([permisos, access]) => {
        if (cancelled) return;
        const roleAllowed =
          !allowedRoles ||
          access.user.roles.some(
            (role) =>
              role.estado.toUpperCase() === "ACTIVO" &&
              allowedRoles.some(
                (allowedRole) =>
                  allowedRole.toUpperCase() === role.nombre.toUpperCase(),
              ),
          );
        setResult({
          key: requestKey,
          outcome:
            permisos.has(permission) && roleAllowed ? "allowed" : "denied",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        if (
          error instanceof PermissionsError &&
          (error.status === 401 || error.status === 403)
        ) {
          clearPermissionsCache();
          clearAuthSession();
          setResult({ key: requestKey, outcome: "unauthenticated" });
          return;
        }

        // Falla de red o del servidor: se niega el acceso por seguridad.
        setResult({ key: requestKey, outcome: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [permission, requestKey, allowedRoles]);

  const outcome = result?.key === requestKey ? result.outcome : null;

  if (outcome === null) {
    return (
      <div className="theme-bg flex min-h-screen items-center justify-center theme-text">
        Verificando permisos...
      </div>
    );
  }

  if (outcome === "unauthenticated") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (outcome === "denied") {
    return <ErrorPage code={403} />;
  }

  if (outcome === "error") {
    return <ErrorPage code={500} />;
  }

  return <>{children}</>;
}
