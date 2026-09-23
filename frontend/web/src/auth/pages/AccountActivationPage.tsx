import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import AuthInput from "../components/AuthInput";

function AccountActivationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError("El enlace de activación no es válido o está incompleto.");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("La contraseña debe tener entre 8 y 128 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("La contraseña debe incluir mayúscula, minúscula, número y carácter especial.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/users/auth/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nueva_contrasena: password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudo activar la cuenta.");
      setMessage(data.message || "Cuenta activada correctamente.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="theme-bg flex min-h-screen items-center justify-center px-6 py-12">
      <section className="glass soft-shadow w-full max-w-lg rounded-3xl p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">Activación de cuenta</p>
        <h1 className="mt-3 text-3xl font-semibold theme-text">Define tu contraseña</h1>
        <p className="mt-3 leading-7 theme-text-soft">Tu cuenta fue creada por un administrador. Define una contraseña propia para comenzar.</p>
        {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{message}</p>}
        {!message && <form onSubmit={submit} className="mt-6 space-y-4">
          <AuthInput id="activation-password" name="activation-password" label="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="text-xs theme-text-muted">Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.</p>
          <AuthInput id="activation-confirmation" name="activation-confirmation" label="Confirmar contraseña" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          {confirmation && <p className={`text-xs ${password === confirmation ? "text-[#47745f]" : "text-red-500"}`}>{password === confirmation ? "Las contraseñas coinciden." : "Las contraseñas no coinciden."}</p>}
          <button disabled={loading} type="submit" className="theme-button-dark w-full rounded-xl px-5 py-3.5 text-sm font-semibold disabled:opacity-60">{loading ? "Activando cuenta..." : "Activar cuenta"}</button>
        </form>}
        <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-[#5b9279]">Volver al inicio de sesión</Link>
      </section>
    </main>
  );
}

export default AccountActivationPage;
