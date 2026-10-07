import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  logout,
  refreshAccessToken,
} from "../services/authApi";
import type { AuthUser } from "../types/auth.types";

function AccountPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const accessToken = localStorage.getItem(
        "sposabella_access_token",
      );

      const refreshToken = localStorage.getItem(
        "sposabella_refresh_token",
      );

      if (!accessToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const currentUser = await getCurrentUser(accessToken);

        setUser(currentUser);

        localStorage.setItem(
          "sposabella_user",
          JSON.stringify(currentUser),
        );
      } catch {
        if (!refreshToken) {
          localStorage.clear();
          navigate("/login", { replace: true });
          return;
        }

        try {
          const response =
            await refreshAccessToken(refreshToken);

          localStorage.setItem(
            "sposabella_access_token",
            response.access_token,
          );

          const currentUser = await getCurrentUser(
            response.access_token,
          );

          setUser(currentUser);

          localStorage.setItem(
            "sposabella_user",
            JSON.stringify(currentUser),
          );
        } catch {
          localStorage.clear();
          navigate("/login", { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [navigate]);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem(
      "sposabella_refresh_token",
    );

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      localStorage.removeItem("sposabella_access_token");
      localStorage.removeItem("sposabella_refresh_token");
      localStorage.removeItem("sposabella_user");

      navigate("/login", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="theme-bg flex min-h-screen items-center justify-center">
        <p className="text-sm theme-text-soft">
          Cargando cuenta...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="theme-bg min-h-screen">
      <header className="border-b theme-border">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.08em] theme-text">
              BOUTIQUE SPOSABELLA
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
              Mi cuenta
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="
              rounded-xl
              border theme-border
              px-4 py-2.5
              text-sm font-semibold theme-text
              transition-colors
              hover:bg-[var(--bg-secondary)]
            "
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
            Cuenta
          </p>

          <h1 className="mt-2 text-3xl font-semibold theme-text">
            Bienvenido, {user.nombre}
          </h1>

          <p className="mt-2 theme-text-soft">
            Información de tu cuenta de usuario.
          </p>
        </div>

        <section className="glass soft-shadow rounded-3xl p-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] theme-text-muted">
                Nombre
              </p>
              <p className="mt-2 font-medium theme-text">
                {user.nombre} {user.apellido}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.15em] theme-text-muted">
                Correo
              </p>
              <p className="mt-2 font-medium theme-text">
                {user.correo}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.15em] theme-text-muted">
                Teléfono
              </p>
              <p className="mt-2 font-medium theme-text">
                {user.telefono || "No registrado"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.15em] theme-text-muted">
                Estado
              </p>
              <p className="mt-2 font-medium theme-text">
                {user.estado}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AccountPage;