import { useEffect, useState } from "react";
import { fetchEffectivePermissions } from "../services/permissions";

/**
 * Permisos efectivos del usuario en la interfaz.
 * `can` devuelve false mientras se cargan los permisos (se oculta por defecto).
 */
export default function usePermissions() {
  const [permisos, setPermisos] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchEffectivePermissions()
      .then((set) => {
        if (!cancelled) setPermisos(set);
      })
      .catch(() => {
        if (!cancelled) setPermisos(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loaded: permisos !== null,
    can: (permission: string) => permisos?.has(permission) ?? false,
  };
}
