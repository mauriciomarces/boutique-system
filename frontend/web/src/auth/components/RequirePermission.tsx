import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import ErrorPage from "../../components/ErrorPage";
import {
  clearPermissionsCache,
  fetchEffectivePermissions,
  PermissionsError,
} from "../services/permissions";
import { clearAuthSession } from "../services/session";

type Outcome = "allowed" | "denied" | "unauthenticated" | "error";

type RequirePermissionProps = {
  permission: string;
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
  children,
}: RequirePermissionProps) {
  const location = useLocation();
  const requestKey = `${permission}|${location.pathname}`;
  const [result, setResult] = useState<{ key: string; outcome: Outcome } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    fetchEffectivePermissions()
      .then((permisos) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          outcome: permisos.has(permission) ? "allowed" : "denied",
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
  }, [permission, requestKey]);

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
