import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthInput from "../components/AuthInput";
import AuthLayout from "../components/AuthLayout";
import AuthMessage from "../components/AuthMessage";
import { register } from "../services/authApi";

function RegisterPage() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (
      !nombre.trim() ||
      !apellido.trim() ||
      !correo.trim() ||
      !contrasena
    ) {
      setError("Completa todos los campos obligatorios.");
      return;
    }

    if (contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      const response = await register({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        telefono: telefono.trim() || undefined,
        contrasena,
      });

      sessionStorage.setItem(
        "sposabella_verification_email",
        correo.trim(),
      );

      if (response.dev_verification_code) {
        sessionStorage.setItem(
          "sposabella_dev_verification_code",
          response.dev_verification_code,
        );
      }

      navigate("/verificar-correo");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible crear la cuenta.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para comenzar a gestionar tu cuenta en SposaBella."
      footer={
        <p className="text-sm theme-text-soft">
          ¿Ya tienes una cuenta?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#5b9279] hover:text-[#47745f]"
          >
            Iniciar sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <AuthMessage type="error">
            {error}
          </AuthMessage>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthInput
            id="nombre"
            name="nombre"
            label="Nombre"
            placeholder="Tu nombre"
            autoComplete="given-name"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            disabled={loading}
          />

          <AuthInput
            id="apellido"
            name="apellido"
            label="Apellido"
            placeholder="Tu apellido"
            autoComplete="family-name"
            value={apellido}
            onChange={(event) => setApellido(event.target.value)}
            disabled={loading}
          />
        </div>

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

        <AuthInput
          id="telefono"
          name="telefono"
          type="tel"
          label="Teléfono"
          placeholder="7XXXXXXX"
          autoComplete="tel"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          disabled={loading}
        />

        <AuthInput
          id="contrasena"
          name="contrasena"
          type="password"
          label="Contraseña"
          placeholder="Crea una contraseña"
          autoComplete="new-password"
          value={contrasena}
          onChange={(event) => setContrasena(event.target.value)}
          disabled={loading}
        />

        <AuthInput
          id="confirmacion"
          name="confirmacion"
          type="password"
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(event) => setConfirmacion(event.target.value)}
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
            transition-all duration-300
            hover:-translate-y-0.5
            hover:shadow-lg
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;