import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthInput from "../components/AuthInput";
import AuthLayout from "../components/AuthLayout";
import AuthMessage from "../components/AuthMessage";
import {
  resendVerification,
  verifyEmail,
} from "../services/authApi";

function VerifyEmailPage() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");

  const [devCode, setDevCode] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem(
      "sposabella_verification_email",
    );

    const savedCode = sessionStorage.getItem(
      "sposabella_dev_verification_code",
    );

    if (savedEmail) {
      setCorreo(savedEmail);
    }

    if (savedCode) {
      setDevCode(savedCode);
    }
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!correo.trim() || !codigo.trim()) {
      setError("Ingresa el correo y el código de verificación.");
      return;
    }

    try {
      setLoading(true);

      await verifyEmail({
        correo: correo.trim(),
        codigo: codigo.trim(),
      });

      sessionStorage.removeItem(
        "sposabella_dev_verification_code",
      );

      setSuccess(
        "Correo verificado correctamente. Ya puedes iniciar sesión.",
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible verificar el correo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");

    if (!correo.trim()) {
      setError("Ingresa primero tu correo electrónico.");
      return;
    }

    try {
      setResending(true);

      const response = await resendVerification(correo.trim());

      if (response.dev_verification_code) {
        setDevCode(response.dev_verification_code);

        sessionStorage.setItem(
          "sposabella_dev_verification_code",
          response.dev_verification_code,
        );
      }

      setSuccess(
        "Se generó un nuevo código de verificación.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible reenviar el código.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verifica tu correo"
      subtitle="Confirma tu dirección de correo para activar tu cuenta."
      footer={
        <p className="text-sm theme-text-soft">
          ¿Ya verificaste tu cuenta?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#5b9279] hover:text-[#47745f]"
          >
            Iniciar sesión
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
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          disabled={loading || resending}
        />

        <AuthInput
          id="codigo"
          name="codigo"
          inputMode="numeric"
          maxLength={6}
          label="Código de verificación"
          placeholder="123456"
          value={codigo}
          onChange={(event) =>
            setCodigo(
              event.target.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          disabled={loading}
        />

        {devCode && (
          <AuthMessage type="info">
            Código de desarrollo: {devCode}
          </AuthMessage>
        )}

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
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading
            ? "Verificando..."
            : "Verificar correo"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={loading || resending}
          className="
            w-full rounded-xl
            border theme-border
            px-5 py-3
            text-sm font-semibold theme-text
            transition-colors
            hover:bg-[var(--bg-secondary)]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {resending
            ? "Generando código..."
            : "Reenviar código"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default VerifyEmailPage;