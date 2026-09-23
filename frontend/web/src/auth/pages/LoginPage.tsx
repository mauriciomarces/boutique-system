import {useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthInput from "../components/AuthInput";
import AuthLayout from "../components/AuthLayout";
import AuthMessage from "../components/AuthMessage";
import { login } from "../services/authApi";

function LoginPage() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!correo.trim() || !contrasena) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    try {
      setLoading(true);

      const response = await login({
        correo: correo.trim(),
        contrasena,
      });

      localStorage.setItem(
        "sposabella_access_token",
        response.access_token,
      );

      localStorage.setItem(
        "sposabella_refresh_token",
        response.refresh_token,
      );

      localStorage.setItem(
        "sposabella_user",
        JSON.stringify(response.user),
      );

      const hasAdminRole = response.user.roles?.some(
        (role) => role.nombre === "ADMIN",
      );

      navigate(hasAdminRole ? "/administracion/usuarios" : "/cuenta");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Ingresa a tu cuenta para continuar."
      footer={
        <p className="text-sm theme-text-soft">
          ¿Todavía no tienes una cuenta?{" "}
          <Link
            to="/registro"
            className="font-semibold text-[#5b9279] transition-colors hover:text-[#47745f]"
          >
            Crear cuenta
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <AuthMessage type="error">
            {error}
          </AuthMessage>
        )}

        <AuthInput
          id="correo"
          name="correo"
          type="email"
          label="Correo electrónico"
          placeholder="tu@correo.com"
          autoComplete="email"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          disabled={loading}
        />

        <div>
          <AuthInput
            id="contrasena"
            name="contrasena"
            type="password"
            label="Contraseña"
            placeholder="Ingresa tu contraseña"
            autoComplete="current-password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            disabled={loading}
          />

          <div className="mt-2 text-right">
            <Link
              to="/recuperar-contrasena"
              className="text-xs font-medium text-[#5b9279] hover:text-[#47745f]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="
            w-full rounded-xl
            theme-button-dark
            px-5 py-3.5
            text-sm font-semibold
            shadow-sm
            transition-all duration-300
            hover:-translate-y-0.5
            hover:shadow-lg
            disabled:cursor-not-allowed
            disabled:opacity-60
            disabled:hover:translate-y-0
          "
        >
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;

