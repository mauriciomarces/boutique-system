import { refreshAccessToken, logout } from "./authApi";

const ACCESS_KEY = "sposabella_access_token";
const REFRESH_KEY = "sposabella_refresh_token";
const USER_KEY = "sposabella_user";

let refreshPromise: Promise<string> | null = null;

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getTokenExpiration(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: number };

    return typeof data.exp === "number" ? data.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function renewSession(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No existe token de renovación.");

    const response = await refreshAccessToken(refreshToken);
    if (!response.access_token) throw new Error("El servidor no devolvió el token.");

    localStorage.setItem(ACCESS_KEY, response.access_token);
    return response.access_token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function endSession() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await logout(refreshToken);
  } catch {
    // Se limpia la sesión local aunque falle la petición al servidor.
  } finally {
    clearAuthSession();
  }
}
