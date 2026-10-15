import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getTokenExpiration, renewSession, clearAuthSession } from "../services/session";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const token = getAccessToken();
        if (!token) throw new Error("No hay sesión");

        const expiration = getTokenExpiration(token);
        if (expiration === null || expiration <= Date.now() + 60000) {
          await renewSession();
        }

        if (!cancelled) setAuthenticated(true);
      } catch {
        clearAuthSession();
        if (!cancelled) setAuthenticated(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (checking) {
    return <div className="theme-bg flex min-h-screen items-center justify-center theme-text">Verificando sesión...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
