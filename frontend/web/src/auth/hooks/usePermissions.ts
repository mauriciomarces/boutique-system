import { useEffect, useState } from "react";
import {
  fetchCurrentUserAccess,
  type PermissionsError,
} from "../services/permissions";

/**
 * Permisos efectivos del usuario en la interfaz.
 * `can` devuelve false mientras se cargan los permisos (se oculta por defecto).
 */
export default function usePermissions() {
  const [permisos, setPermisos] = useState<Set<string> | null>(null);
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<PermissionsError | Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestGeneration = 0;

    const loadPermissions = () => {
      const currentGeneration = ++requestGeneration;
      setPermisos(null);
      setError(null);
      fetchCurrentUserAccess()
        .then((access) => {
          if (!cancelled && currentGeneration === requestGeneration) {
            setPermisos(access.permisos);
            setRoles(
              new Set(
                access.user.roles
                  .filter((role) => role.estado.toUpperCase() === "ACTIVO")
                  .map((role) => role.nombre.toUpperCase()),
              ),
            );
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled && currentGeneration === requestGeneration) {
            setPermisos(new Set());
            setRoles(new Set());
            setError(
              cause instanceof Error
                ? cause
                : new Error("No se pudieron consultar los permisos."),
            );
          }
        });
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === "sposabella_access_token" ||
        event.key === "sposabella_user" ||
        event.key === null
      ) {
        loadPermissions();
      }
    };

    loadPermissions();
    window.addEventListener("sposabella:auth-session-changed", loadPermissions);
    window.addEventListener("sposabella:permissions-updated", loadPermissions);
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(
        "sposabella:auth-session-changed",
        loadPermissions,
      );
      window.removeEventListener(
        "sposabella:permissions-updated",
        loadPermissions,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    loaded: permisos !== null,
    can: (permission: string) => permisos?.has(permission) ?? false,
    hasRole: (role: string) => roles.has(role.toUpperCase()),
    error,
  };
}
