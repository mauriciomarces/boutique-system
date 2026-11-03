import { getAccessToken } from "./session";

export class PermissionsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PermissionsError";
    this.status = status;
  }
}

type PermissionsCache = {
  token: string;
  permisos: Set<string>;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
let cache: PermissionsCache | null = null;

/**
 * Obtiene los permisos efectivos del usuario autenticado desde
 * GET /api/users/auth/me. Son una ayuda de interfaz: la autorización real
 * la siguen aplicando los servicios del backend.
 */
export async function fetchEffectivePermissions(): Promise<Set<string>> {
  const token = getAccessToken();
  if (!token) {
    throw new PermissionsError("No hay sesión activa.", 401);
  }

  if (cache && cache.token === token && cache.expiresAt > Date.now()) {
    return cache.permisos;
  }

  const response = await fetch("/api/users/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new PermissionsError(
      payload?.error || "No se pudieron consultar los permisos.",
      response.status,
    );
  }

  const permisos = new Set<string>(
    Array.isArray(payload?.permisos) ? payload.permisos : [],
  );

  cache = { token, permisos, expiresAt: Date.now() + CACHE_TTL_MS };
  return permisos;
}

export function clearPermissionsCache() {
  cache = null;
}
