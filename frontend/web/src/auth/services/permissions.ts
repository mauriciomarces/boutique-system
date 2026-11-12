import { getAccessToken } from "./session";

export class PermissionsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PermissionsError";
    this.status = status;
  }
}

export type CurrentUserAccess = {
  user: {
    id: string;
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string | null;
    estado: string;
    correo_verificado?: boolean;
    roles: Array<{
      id: string;
      nombre: string;
      descripcion: string | null;
      estado: string;
    }>;
  };
  permisos: Set<string>;
};

type PermissionsCache = {
  token: string;
  access: CurrentUserAccess;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
let cache: PermissionsCache | null = null;
let pending:
  | { token: string; request: Promise<CurrentUserAccess> }
  | null = null;
let cacheGeneration = 0;

export function clearPermissionsCache() {
  cacheGeneration += 1;
  cache = null;
  pending = null;
}

export function notifyPermissionsUpdated() {
  clearPermissionsCache();
  window.dispatchEvent(new Event("sposabella:permissions-updated"));
}

if (typeof window !== "undefined") {
  window.addEventListener("sposabella:auth-session-changed", clearPermissionsCache);
  window.addEventListener("storage", (event) => {
    if (
      event.key === "sposabella_access_token" ||
      event.key === "sposabella_user" ||
      event.key === null
    ) {
      clearPermissionsCache();
    }
  });
}

/**
 * Obtiene los permisos efectivos del usuario autenticado desde
 * GET /api/users/auth/me. El backend sigue siendo la autoridad de acceso.
 */
export async function fetchEffectivePermissions(): Promise<Set<string>> {
  const { permisos } = await fetchCurrentUserAccess();
  return permisos;
}

export async function fetchCurrentUserAccess(): Promise<CurrentUserAccess> {
  const token = getAccessToken();
  if (!token) {
    throw new PermissionsError("No hay sesión activa.", 401);
  }

  if (cache && cache.token === token && cache.expiresAt > Date.now()) {
    return cache.access;
  }

  if (pending?.token === token) {
    return pending.request;
  }

  const requestGeneration = cacheGeneration;
  const request = (async (): Promise<CurrentUserAccess> => {
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

    if (!Array.isArray(payload?.permisos) || !Array.isArray(payload?.roles)) {
      throw new PermissionsError(
        "El servidor devolvió una respuesta de permisos incompleta.",
        502,
      );
    }

    const permisos = new Set<string>(
      payload.permisos.filter(
        (permission: unknown): permission is string =>
          typeof permission === "string" && permission.length > 0,
      ),
    );
    const hasActiveAdminRole = payload.roles.some(
      (role: { nombre?: unknown; estado?: unknown }) =>
        typeof role?.nombre === "string" &&
        role.nombre.toUpperCase() === "ADMIN" &&
        typeof role.estado === "string" &&
        role.estado.toUpperCase() === "ACTIVO",
    );

    if (hasActiveAdminRole && permisos.size === 0) {
      throw new PermissionsError(
        "El servidor no devolvió el catálogo de permisos del administrador.",
        502,
      );
    }

    const user = payload as CurrentUserAccess["user"];
    if (
      getAccessToken() !== token ||
      cacheGeneration !== requestGeneration
    ) {
      throw new PermissionsError("La sesión cambió durante la consulta.", 409);
    }

    const access = { user, permisos };
    cache = { token, access, expiresAt: Date.now() + CACHE_TTL_MS };
    return access;
  })();

  pending = { token, request };
  try {
    return await request;
  } finally {
    if (pending?.request === request) pending = null;
  }
}
