import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthInput from "../components/AuthInput";
import AuthLayout from "../components/AuthLayout";
import AuthMessage from "../components/AuthMessage";
import { resetPassword } from "../services/authApi";

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem(
      "sposabella_recovery_email",
    );

    if (savedEmail) {
      setCorreo(savedEmail);
    }
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!correo) {
      setError(
        "Solicita primero un código de recuperación con tu correo electrónico.",
      );
      return;
    }

    if (!/^\d{6}$/.test(codigo)) {
      setError("Ingresa el código de recuperación de 6 dígitos.");
      return;
    }

    if (!nuevaContrasena) {
      setError("Ingresa una nueva contraseña.");
      return;
    }

    if (nuevaContrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      await resetPassword({
        correo,
        codigo,
        nueva_contrasena: nuevaContrasena,
      });

      sessionStorage.removeItem("sposabella_recovery_email");

      setSuccess(
        "Contraseña actualizada correctamente. Ahora puedes iniciar sesión.",
      );

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible restablecer la contraseña.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Nueva contraseña"
      subtitle="Ingresa el código recibido y establece una nueva contraseña."
      footer={
        <p className="text-sm theme-text-soft">
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
          id="codigo"
          name="codigo"
          inputMode="numeric"
          maxLength={6}
          label="Código de recuperación"
          placeholder="123456"
          value={codigo}
          onChange={(event) =>
            setCodigo(
              event.target.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          disabled={loading}
        />

        <AuthInput
          id="nueva-contrasena"
          name="nueva-contrasena"
          type="password"
          label="Nueva contraseña"
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          value={nuevaContrasena}
          onChange={(event) =>
            setNuevaContrasena(event.target.value)
          }
          disabled={loading}
        />

        <AuthInput
          id="confirmacion"
          name="confirmacion"
          type="password"
          label="Confirmar contraseña"
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(event) =>
            setConfirmacion(event.target.value)
          }
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
            ? "Actualizando..."
            : "Cambiar contraseña"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
