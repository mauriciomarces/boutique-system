import { useEffect, useMemo, useState } from "react";
import { fetchEffectivePermissions } from "../../auth/services/permissions";

interface Permission {
  id: string;
  nombre: string;
  descripcion: string | null;
}

interface Role {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

type RolePermissionMatrixProps = {
  token: string;
  roles: Role[];
  permissions: Permission[];
  labels: Record<string, string>;
};

type Message = { type: "error" | "notice"; text: string };

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        "No se pudo completar la operación.",
    );
  }

  return payload as T;
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

/**
 * Asigna o quita permisos de un rol usando POST/DELETE /roles/:id/permisos.
 * El rol ADMIN no se edita desde aquí, igual que en el resto de la administración.
 */
function RolePermissionMatrix({
  token,
  roles,
  permissions,
  labels,
}: RolePermissionMatrixProps) {
  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.nombre !== "ADMIN" && role.estado === "ACTIVO",
      ),
    [roles],
  );

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [canAssign, setCanAssign] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  // Permisos cargados para un rol concreto; se descartan si cambia el rol.
  const [loaded, setLoaded] = useState<{
    roleId: string;
    assigned: Set<string>;
    error: string | null;
  } | null>(null);

  // Si el rol seleccionado ya no es configurable, se usa el primero disponible.
  const activeRoleId = assignableRoles.some((role) => role.id === selectedRoleId)
    ? selectedRoleId
    : (assignableRoles[0]?.id ?? "");

  const selectedRole =
    assignableRoles.find((role) => role.id === activeRoleId) ?? null;

  const loadingRole = activeRoleId !== "" && loaded?.roleId !== activeRoleId;
  const assigned =
    loaded && loaded.roleId === activeRoleId ? loaded.assigned : new Set<string>();

  useEffect(() => {
    let cancelled = false;

    fetchEffectivePermissions()
      .then((permisos) => {
        if (!cancelled) setCanAssign(permisos.has("ROLES_ASIGNAR_PERMISOS"));
      })
      .catch(() => {
        if (!cancelled) setCanAssign(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRoleId) return;

    let cancelled = false;

    request<Permission[]>(`/roles/${activeRoleId}/permisos`, token)
      .then((list) => {
        if (cancelled) return;
        setLoaded({
          roleId: activeRoleId,
          assigned: new Set(list.map((p) => p.id)),
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoaded({
          roleId: activeRoleId,
          assigned: new Set(),
          error: errorText(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoleId, token]);

  const loadError =
    loaded && loaded.roleId === activeRoleId ? loaded.error : null;

  const togglePermission = async (permission: Permission) => {
    if (!selectedRole) return;

    const isAssigned = assigned.has(permission.id);
    setSavingId(permission.id);
    setMessage(null);

    try {
      if (isAssigned) {
        await request(
          `/roles/${selectedRole.id}/permisos/${permission.id}`,
          token,
          { method: "DELETE" },
        );
      } else {
        await request(`/roles/${selectedRole.id}/permisos`, token, {
          method: "POST",
          body: JSON.stringify({ permiso_id: permission.id }),
        });
      }

      setLoaded((previous) => {
        if (!previous || previous.roleId !== selectedRole.id) return previous;
        const next = new Set(previous.assigned);
        if (isAssigned) next.delete(permission.id);
        else next.add(permission.id);
        return { ...previous, assigned: next };
      });

      setMessage({
        type: "notice",
        text: `Permiso ${isAssigned ? "quitado de" : "asignado a"} ${selectedRole.nombre}.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="glass soft-shadow mt-6 rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold theme-text">Permisos por rol</h2>
          <p className="mt-1 text-sm theme-text-soft">
            Selecciona un rol y marca los permisos que debe tener.
          </p>
        </div>

        <select
          onChange={(event) => {
            setSelectedRoleId(event.target.value);
            setMessage(null);
          }}
          value={activeRoleId}
          disabled={assignableRoles.length === 0}
          className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm theme-text"
        >
          {assignableRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.nombre}
            </option>
          ))}
        </select>
      </div>

      {!canAssign && (
        <p className="mt-4 rounded-xl bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text-soft">
          Tu cuenta no tiene el permiso ROLES_ASIGNAR_PERMISOS. Puedes consultar, pero no modificar.
        </p>
      )}

      {(message || loadError) && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            (message?.type ?? "error") === "error"
              ? "bg-[#f7e7e7] text-[#9c5c5c]"
              : "bg-[#e9f6ef] text-[#47745f]"
          }`}
        >
          {message?.text ?? loadError}
        </p>
      )}

      {assignableRoles.length === 0 ? (
        <p className="mt-5 text-sm theme-text-soft">
          No hay roles activos que se puedan configurar.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {permissions.map((permission) => {
            const checked = assigned.has(permission.id);
            const disabled =
              !canAssign || !selectedRole || loadingRole || savingId !== null;

            return (
              <label
                key={permission.id}
                className={`flex items-start gap-3 rounded-xl border theme-border p-4 ${
                  disabled ? "opacity-70" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => void togglePermission(permission)}
                />

                <span>
                  <span className="block text-sm font-semibold theme-text">
                    {labels[permission.nombre] || permission.nombre}
                  </span>
                  <span className="mt-1 block text-xs theme-text-soft">
                    {permission.nombre}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RolePermissionMatrix;
