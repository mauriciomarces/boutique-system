import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthInput from "../components/AuthInput";
import AuthLayout from "../components/AuthLayout";
import AuthMessage from "../components/AuthMessage";
import { forgotPassword } from "../services/authApi";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!correo.trim()) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    try {
      setLoading(true);

      const response = await forgotPassword({
        correo: correo.trim(),
      });

      sessionStorage.setItem(
        "sposabella_recovery_email",
        correo.trim(),
      );

      setSuccess(
        response.message,
      );

      setTimeout(() => {
        navigate("/restablecer-contrasena");
      }, 900);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible solicitar la recuperación.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te enviaremos un código para restablecer el acceso a tu cuenta."
      footer={
        <p className="text-sm theme-text-soft">
          ¿Recuerdas tu contraseña?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#5b9279] hover:text-[#47745f]"
          >
            Volver al inicio de sesión
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

        {success && (
          <AuthMessage type="success">
            {success}
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

        <button
          type="submit"
          disabled={loading}
          className="
            w-full rounded-xl
            theme-button-dark
            px-5 py-3.5
            text-sm font-semibold
            shadow-sm
            transition-all
            hover:-translate-y-0.5
            hover:shadow-lg
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading
            ? "Solicitando..."
            : "Enviar código"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
