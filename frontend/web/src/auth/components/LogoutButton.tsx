import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { endSession } from "../services/session";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await endSession();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className={`rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text disabled:opacity-60 ${className}`}
    >
      {loading ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}
