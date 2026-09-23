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

  const passwordChecks = [
    { label: "8 caracteres mínimo", valid: contrasena.length >= 8 },
    { label: "Una mayúscula", valid: /[A-Z]/.test(contrasena) },
    { label: "Una minúscula", valid: /[a-z]/.test(contrasena) },
    { label: "Un número", valid: /\d/.test(contrasena) },
    { label: "Un carácter especial", valid: /[^A-Za-z0-9]/.test(contrasena) },
  ];

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

    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/.test(nombre.trim())) {
      setError("El nombre solo puede contener letras y espacios válidos.");
      return;
    }

    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/.test(apellido.trim())) {
      setError("El apellido solo puede contener letras y espacios válidos.");
      return;
    }

    if (telefono && !/^\d{8,9}$/.test(telefono)) {
      setError("El teléfono debe contener entre 8 y 9 dígitos.");
      return;
    }

    if (passwordChecks.some((check) => !check.valid)) {
      setError("La contraseña debe cumplir todos los requisitos indicados.");
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
            onChange={(event) => setNombre(event.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]/g, ""))}
            disabled={loading}
            pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*"
          />

          <AuthInput
            id="apellido"
            name="apellido"
            label="Apellido"
            placeholder="Tu apellido"
            autoComplete="family-name"
            value={apellido}
            onChange={(event) => setApellido(event.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]/g, ""))}
            disabled={loading}
            pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*"
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
          onChange={(event) => setTelefono(event.target.value.replace(/\D/g, "").slice(0, 9))}
          disabled={loading}
          inputMode="numeric"
          maxLength={9}
          pattern="\d{8,9}"
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

        <div className="grid gap-1 text-xs theme-text-muted sm:grid-cols-2">
          {passwordChecks.map((check) => (
            <span key={check.label} className={check.valid ? "text-[#47745f]" : ""}>
              {check.valid ? "✓" : "○"} {check.label}
            </span>
          ))}
        </div>

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

        {confirmacion && (
          <p className={`text-xs ${contrasena === confirmacion ? "text-[#47745f]" : "text-red-500"}`}>
            {contrasena === confirmacion ? "Las contraseñas coinciden." : "Las contraseñas no coinciden."}
          </p>
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