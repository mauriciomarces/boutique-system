import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elementName: string]: any;
    }
  }
}

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

interface User {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  estado: string;
  correo_verificado?: boolean;
  usuario_rol?: Array<{ roles?: Role | null }>;
}

type Section = "usuarios" | "inactivos" | "roles" | "permisos";

const roleOptions = ["SUPERVISOR", "VENDEDOR", "INVENTARIO", "CONSULTA"];

const permissionLabels: Record<string, string> = {
  USUARIOS_LEER: "Consultar usuarios",
  USUARIOS_CREAR: "Crear usuarios",
  USUARIOS_EDITAR: "Editar usuarios y asignar roles",
  USUARIOS_CAMBIAR_ESTADO: "Activar o desactivar usuarios",
  ROLES_LEER: "Consultar roles",
  ROLES_CREAR: "Crear roles",
  ROLES_EDITAR: "Editar roles",
  ROLES_ASIGNAR_PERMISOS: "Asignar permisos a roles",
  PERMISOS_LEER: "Consultar permisos",
  PRODUCTOS_LEER: "Consultar productos",
  PRODUCTOS_CREAR: "Crear productos",
  PRODUCTOS_EDITAR: "Editar productos",
  PRODUCTOS_ELIMINAR: "Eliminar productos",
  INVENTARIO_LEER: "Consultar inventario",
  INVENTARIO_EDITAR: "Editar inventario",
  VENTAS_LEER: "Consultar ventas",
  VENTAS_CREAR: "Crear ventas",
  VENTAS_EDITAR: "Editar ventas",
  NOTIFICACIONES_LEER: "Consultar notificaciones",
};

const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?: [A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
) {
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

function AdminUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("sposabella_access_token");
  const section: Section = location.pathname.endsWith(
    "/usuarios-inactivos",
  )
    ? "inactivos"
    : location.pathname.endsWith("/roles")
      ? "roles"
      : location.pathname.endsWith("/permisos")
        ? "permisos"
        : "usuarios";
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "create" | "edit" | "assign-role" | null
  >(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleId, setRoleId] = useState("");
  const [roleForm, setRoleForm] = useState({
    nombre: "",
    descripcion: "",
  });
  const [userForm, setUserForm] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
    rol_id: "",
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.estado === "ACTIVO" &&
          role.nombre !== "ADMIN",
      ),
    [roles],
  );

  const loadData = async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [me, userList, roleList, permissionList] = await Promise.all([
        request<User>("/users/auth/me", token),
        request<User[]>("/users", token),
        request<Role[]>("/roles", token),
        request<Permission[]>("/permisos", token),
      ]);

      setCurrentUser(me);
      setUsers(userList);
      setRoles(roleList);
      setPermissions(permissionList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar la administración.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [navigate]);

  const visibleUsers = useMemo(() => {
    const value = search.trim().toLowerCase();

    const source =
      section === "inactivos"
        ? users.filter((user) => user.estado !== "ACTIVO")
        : users.filter((user) => user.estado === "ACTIVO");

    return value
      ? source.filter((user) =>
          `${user.nombre} ${user.apellido} ${user.correo}`
            .toLowerCase()
            .includes(value),
        )
      : source;
  }, [search, section, users]);

  const pageSize = 8;
  const totalPages = Math.max(
    1,
    Math.ceil(visibleUsers.length / pageSize),
  );
  const pageUsers = visibleUsers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const fail = (err: unknown) => {
    setNotice("");
    setError(
      err instanceof Error
        ? err.message
        : "No se pudo completar la operación.",
    );
  };


  const closeModal = () => {
    setModal(null);
    setSelectedUser(null);
    setRoleId("");
    setError("");
    setNotice("");
  };

  const validateUserForm = () => {
    const nombre = userForm.nombre.trim();
    const apellido = userForm.apellido.trim();
    const correo = userForm.correo.trim();

    if (!nameRegex.test(nombre)) {
      setError(
        "El nombre solo puede contener letras y espacios entre palabras.",
      );
      return false;
    }

    if (!nameRegex.test(apellido)) {
      setError(
        "El apellido solo puede contener letras y espacios entre palabras.",
      );
      return false;
    }

    if (!emailRegex.test(correo)) {
      setError("Introduce un correo electrónico válido.");
      return false;
    }

    if (!/^\d{8,9}$/.test(userForm.telefono)) {
      setError("El teléfono debe contener entre 8 y 9 dígitos.");
      return false;
    }

    return true;
  };

  const handleNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key.length !== 1) {
      return;
    }

    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/.test(event.key)) {
      event.preventDefault();
      return;
    }

    if (
      event.key === " " &&
      (!event.currentTarget.value ||
        event.currentTarget.value.endsWith(" "))
    ) {
      event.preventDefault();
    }
  };

  const handleNameBeforeInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const nativeEvent = event.nativeEvent as InputEvent;

    if (
      nativeEvent.data &&
      !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]+$/.test(nativeEvent.data)
    ) {
      event.preventDefault();
    }
  };

  const handleNamePaste = (
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    const pastedText = event.clipboardData.getData("text");

    if (!nameRegex.test(pastedText)) {
      event.preventDefault();
    }
  };

  const handleEmailKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key.length === 1 && /\s/.test(event.key)) {
      event.preventDefault();
    }
  };

  const handleEmailPaste = (
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    const pastedText = event.clipboardData.getData("text");

    if (/\s/.test(pastedText)) {
      event.preventDefault();
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    if (!validateUserForm()) {
      return;
    }

    try {
      await request("/users", token, {
        method: "POST",
        body: JSON.stringify({
          ...userForm,
          nombre: userForm.nombre.trim(),
          apellido: userForm.apellido.trim(),
          correo: userForm.correo.trim(),
        }),
      });

      closeModal();

      setUserForm({
        nombre: "",
        apellido: "",
        correo: "",
        telefono: "",
        rol_id: "",
      });

      setNotice(
        "Usuario creado. Se envió un enlace para que defina su contraseña.",
      );

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const editUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !selectedUser) {
      return;
    }

    setError("");
    setNotice("");

    if (!validateUserForm()) {
      return;
    }

    try {
      await request(`/users/${selectedUser.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          nombre: userForm.nombre.trim(),
          apellido: userForm.apellido.trim(),
          correo: userForm.correo.trim(),
          telefono: userForm.telefono || null,
        }),
      });

      closeModal();
      setNotice("Usuario actualizado correctamente.");

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const toggleUser = async (user: User) => {
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    if (
      user.id === currentUser?.id &&
      user.estado === "ACTIVO"
    ) {
      setError("No puedes desactivarte a ti mismo.");
      return;
    }

    try {
      const estado =
        user.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

      await request(`/users/${user.id}/estado`, token, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });

      setNotice(
        `Usuario ${
          estado === "ACTIVO" ? "activado" : "desactivado"
        } correctamente.`,
      );

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const resendActivation = async (user: User) => {
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(
        `/users/${user.id}/reenviar-activacion`,
        token,
        {
          method: "POST",
          body: "{}",
        },
      );

      setNotice("Se envió un nuevo enlace de activación.");
    } catch (err) {
      fail(err);
    }
  };

  const assignRole = async () => {
    if (!token || !selectedUser || !roleId) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`/usuarios/${selectedUser.id}/roles`, token, {
        method: "POST",
        body: JSON.stringify({ rol_id: roleId }),
      });

      closeModal();
      setNotice("Rol asignado correctamente.");

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const removeRole = async (user: User, role: Role) => {
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    if (role.nombre === "ADMIN") {
      setError("El rol ADMIN no puede quitarse desde esta interfaz.");
      return;
    }

    try {
      await request(
        `/usuarios/${user.id}/roles/${role.id}`,
        token,
        {
          method: "DELETE",
        },
      );

      setNotice(
        `Rol ${role.nombre} quitado de ${user.nombre} ${user.apellido}.`,
      );

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request("/roles", token, {
        method: "POST",
        body: JSON.stringify(roleForm),
      });

      setRoleForm({
        nombre: "",
        descripcion: "",
      });

      setNotice("Rol creado correctamente.");

      await loadData();
    } catch (err) {
      fail(err);
    }
  };

  const toggleRole = async (role: Role) => {
    if (!token) {
      return;
    }

    setError("");
    setNotice("");

    if (role.nombre === "ADMIN") {
      setError("El rol ADMIN no puede desactivarse.");
      return;
    }

    try {
      const estado =
        role.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

      await request(`/roles/${role.id}/estado`, token, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });

      setNotice(
        `Rol ${estado === "ACTIVO" ? "activado" : "desactivado"} correctamente.`,
      );

      await loadData();
    } catch (err) {
      fail(err);
    }
  };


  const openEdit = (user: User) => {
    setError("");
    setNotice("");
    setSelectedUser(user);

    setUserForm({
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      telefono: user.telefono || "",
      rol_id: "",
    });

    setModal("edit");
  };

  const openRole = (user: User) => {
    setError("");
    setNotice("");
    setSelectedUser(user);
    setRoleId("");
    setModal("assign-role");
  };

  const openCreate = () => {
    setError("");
    setNotice("");

    setUserForm({
      nombre: "",
      apellido: "",
      correo: "",
      telefono: "",
      rol_id: "",
    });

    setModal("create");
  };

  return (
    <div className="theme-bg min-h-screen">
      <header className="relative border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
  <button
    type="button"
    onClick={() => setSidebarOpen((value) => !value)}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border theme-border bg-[var(--bg)] theme-text shadow-lg lg:hidden"
    aria-label="Abrir menú administrativo"
    aria-expanded={sidebarOpen}
  >
    <span className="flex flex-col gap-1.5">
      <span className="block h-0.5 w-5 rounded-full bg-current" />
      <span className="block h-0.5 w-5 rounded-full bg-current" />
      <span className="block h-0.5 w-5 rounded-full bg-current" />
    </span>
  </button>

  <Link to="/" className="min-w-0 theme-text">
    <p className="text-sm font-semibold tracking-[0.08em]">
      BOUTIQUE SPOSABELLA
    </p>
    <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
      Centro de gestión
    </p>
  </Link>
</div>

          <div className="flex items-center gap-3">

            <span className="hidden text-sm theme-text-soft sm:block">
              {currentUser
                ? `${currentUser.nombre} ${currentUser.apellido}`
                : "Administrador"}
            </span>

            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                navigate("/login", { replace: true });
              }}
              className="rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <AdministrationSidebar
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
                Administración
              </p>

              <h1 className="mt-2 text-3xl font-semibold theme-text">
                {section === "usuarios"
                  ? "Usuarios activos"
                  : section === "inactivos"
                    ? "Usuarios inactivos"
                    : section === "roles"
                      ? "Roles"
                      : section === "permisos"
                        ? "Permisos"
                        : "Clientes"}
              </h1>

              <p className="mt-2 theme-text-soft">
                Gestiona el acceso sin eliminar información.
              </p>
            </div>

            {section === "usuarios" && (
              <button
                type="button"
                onClick={openCreate}
                className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
              >
                + Crear usuario
              </button>
            )}
          </div>

            {error && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <span>{error}</span>

                <button
                  type="button"
                  onClick={() => setError("")}
                  className="shrink-0 text-lg font-semibold leading-none text-red-500 hover:text-red-700"
                  aria-label="Cerrar mensaje de error"
                  title="Cerrar"
                >
                  ×
                </button>
              </div>
            )}

            {notice && (
              <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                <span>{notice}</span>

                <button
                  type="button"
                  onClick={() => setNotice("")}
                  className="shrink-0 text-lg font-semibold leading-none text-green-600 hover:text-green-800"
                  aria-label="Cerrar mensaje"
                  title="Cerrar"
                >
                  ×
                </button>
              </div>
            )}

          {loading ? (
            <div className="glass soft-shadow rounded-2xl p-8 theme-text-soft">
              Cargando administración...
            </div>
          ) : section === "roles" ? (
            <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="glass soft-shadow overflow-hidden rounded-2xl">
                <div className="border-b theme-border p-5">
                  <h2 className="font-semibold theme-text">
                    Roles disponibles
                  </h2>
                </div>

                <div className="divide-y theme-border">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium theme-text">
                          {role.nombre}
                        </p>

                        <p className="mt-1 text-sm theme-text-soft">
                          {role.descripcion || "Sin descripción"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            role.estado === "ACTIVO"
                              ? "bg-[#e9f6ef] text-[#47745f]"
                              : "bg-[#f7e7e7] text-[#9c5c5c]"
                          }`}
                        >
                          {role.estado}
                        </span>

                        {role.nombre !== "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => void toggleRole(role)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                              role.estado === "ACTIVO"
                                ? "border-[#d49a9a] text-[#9c5c5c]"
                                : "border-[#6cad91] text-[#47745f]"
                            }`}
                          >
                            {role.estado === "ACTIVO"
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={createRole}
                className="glass soft-shadow rounded-2xl p-5"
              >
                <h2 className="font-semibold theme-text">
                  Crear rol
                </h2>

                <select
                  required
                  value={roleForm.nombre}
                  onChange={(event) =>
                    setRoleForm({
                      ...roleForm,
                      nombre: event.target.value,
                    })
                  }
                  className="mt-4 w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                >
                  <option value="">Selecciona un rol</option>
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <textarea
                  value={roleForm.descripcion}
                  onChange={(event) =>
                    setRoleForm({
                      ...roleForm,
                      descripcion: event.target.value,
                    })
                  }
                  placeholder="Descripción opcional"
                  className="mt-3 min-h-24 w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
                />

                <button
                  type="submit"
                  className="theme-button-dark mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold"
                >
                  Crear rol
                </button>
              </form>
            </section>
          ) : section === "permisos" ? (
            <section className="glass soft-shadow rounded-2xl p-5">
              <h2 className="font-semibold theme-text">
                Permisos del sistema
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="rounded-xl border theme-border p-4"
                  >
                    <p className="text-sm font-semibold theme-text">
                      {permissionLabels[permission.nombre] ||
                        permission.nombre
                          .replaceAll("_", " ")
                          .toLowerCase()}
                    </p>

                    <p className="mt-1 text-xs theme-text-soft">
                      {permission.descripcion}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="glass soft-shadow overflow-hidden rounded-2xl">
              <div className="flex flex-col gap-4 border-b theme-border p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold theme-text">
                    Directorio de usuarios
                  </h2>

                  <p className="mt-1 text-sm theme-text-soft">
                    {visibleUsers.length} usuarios encontrados
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por nombre o correo"
                  className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm theme-text sm:w-72"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                    <tr>
                      <th className="px-5 py-4 font-medium">
                        Usuario
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Correo
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Estado
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Roles
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t theme-border"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium theme-text">
                            {user.nombre} {user.apellido}
                          </p>

                          <p className="mt-1 text-xs theme-text-muted">
                            ID #{user.id}
                          </p>
                        </td>

                        <td className="px-5 py-4 theme-text-soft">
                          {user.correo}
                          <br />
                          <span className="text-xs">
                            {user.telefono || "Sin teléfono"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              user.estado === "ACTIVO"
                                ? "bg-[#e9f6ef] text-[#47745f]"
                                : "bg-[#f7e7e7] text-[#9c5c5c]"
                            }`}
                          >
                            {user.estado}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {user.usuario_rol?.map((item, index) => {
                              const role = item.roles;

                              if (!role) {
                                return (
                                  <span
                                    key={`${user.id}-${index}`}
                                    className="rounded-full border theme-border px-2 py-1 text-xs theme-text-soft"
                                  >
                                    Sin rol
                                  </span>
                                );
                              }

                              return (
                                <div
                                  key={`${user.id}-${role.id}-${index}`}
                                  className="flex items-center gap-1 rounded-full border theme-border px-2 py-1"
                                >
                                  <span className="text-xs theme-text-soft">
                                    {role.nombre}
                                  </span>

                                  {role.nombre !== "ADMIN" && (
                                    <button
                                      type="button"
                                      onClick={() => void removeRole(user, role)}
                                      className="ml-1 text-xs font-bold text-[#9c5c5c]"
                                      title={`Quitar rol ${role.nombre}`}
                                      aria-label={`Quitar rol ${role.nombre}`}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => openRole(user)}
                              className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text"
                            >
                              Asignar rol
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleUser(user)}
                              className="rounded-lg border border-[#d49a9a] px-3 py-1.5 text-xs font-semibold text-[#9c5c5c]"
                            >
                              {user.estado === "ACTIVO"
                                ? "Desactivar"
                                : "Activar"}
                            </button>

                            {section === "inactivos" &&
                              !user.correo_verificado && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void resendActivation(user)
                                  }
                                  className="rounded-lg border border-[#6cad91] px-3 py-1.5 text-xs font-semibold text-[#47745f]"
                                >
                                  Reenviar activación
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t theme-border px-5 py-4 text-sm theme-text-soft">
                <span>
                  Página {page} de {totalPages}
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() =>
                      setPage((value) => value - 1)
                    }
                    className="rounded-lg border theme-border px-3 py-1.5 disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((value) => value + 1)
                    }
                    className="rounded-lg border theme-border px-3 py-1.5 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {modal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={createUser}
            className="w-full max-w-lg rounded-2xl bg-[var(--bg)] p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  Crear usuario
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  El usuario definirá su propia contraseña desde el
                  enlace recibido.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl theme-text-muted"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                required
                pattern={nameRegex.source}
                title="Usa únicamente letras y espacios entre palabras"
                value={userForm.nombre}
                onKeyDown={handleNameKeyDown}
                onBeforeInput={handleNameBeforeInput}
                onPaste={handleNamePaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    nombre: event.target.value,
                  })
                }
                placeholder="Nombre"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <input
                required
                pattern={nameRegex.source}
                title="Usa únicamente letras y espacios entre palabras"
                value={userForm.apellido}
                onKeyDown={handleNameKeyDown}
                onBeforeInput={handleNameBeforeInput}
                onPaste={handleNamePaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    apellido: event.target.value,
                  })
                }
                placeholder="Apellido"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <input
                required
                type="email"
                pattern={emailRegex.source}
                title="Introduce un correo electrónico válido"
                value={userForm.correo}
                onKeyDown={handleEmailKeyDown}
                onPaste={handleEmailPaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    correo: event.target.value,
                  })
                }
                placeholder="Correo electrónico"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <input
                required
                pattern="\d{8,9}"
                maxLength={9}
                inputMode="numeric"
                title="Introduce entre 8 y 9 dígitos"
                value={userForm.telefono}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    telefono: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 9),
                  })
                }
                placeholder="Teléfono (8-9 dígitos)"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <select
                value={userForm.rol_id}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    rol_id: event.target.value,
                  })
                }
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text sm:col-span-2"
              >
                <option value="">Sin rol inicial</option>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border theme-border px-4 py-3 text-sm theme-text"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="theme-button-dark rounded-xl px-4 py-3 text-sm font-semibold"
              >
                Crear y enviar activación
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === "edit" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={editUser}
            className="w-full max-w-lg rounded-2xl bg-[var(--bg)] p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold theme-text">
                Editar usuario
              </h2>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl theme-text-muted"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                required
                pattern={nameRegex.source}
                title="Usa únicamente letras y espacios entre palabras"
                value={userForm.nombre}
                onKeyDown={handleNameKeyDown}
                onBeforeInput={handleNameBeforeInput}
                onPaste={handleNamePaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    nombre: event.target.value,
                  })
                }
                placeholder="Nombre"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <input
                required
                pattern={nameRegex.source}
                title="Usa únicamente letras y espacios entre palabras"
                value={userForm.apellido}
                onKeyDown={handleNameKeyDown}
                onBeforeInput={handleNameBeforeInput}
                onPaste={handleNamePaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    apellido: event.target.value,
                  })
                }
                placeholder="Apellido"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
              />

              <input
                required
                type="email"
                pattern={emailRegex.source}
                title="Introduce un correo electrónico válido"
                value={userForm.correo}
                onKeyDown={handleEmailKeyDown}
                onPaste={handleEmailPaste}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    correo: event.target.value,
                  })
                }
                placeholder="Correo electrónico"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text sm:col-span-2"
              />

              <input
                required
                pattern="\d{8,9}"
                maxLength={9}
                inputMode="numeric"
                title="Introduce entre 8 y 9 dígitos"
                value={userForm.telefono}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    telefono: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 9),
                  })
                }
                placeholder="Teléfono (8-9 dígitos)"
                className="rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text sm:col-span-2"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border theme-border px-4 py-3 text-sm theme-text"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="theme-button-dark rounded-xl px-4 py-3 text-sm font-semibold"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === "assign-role" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-[var(--bg)] p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  Asignar rol
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  {selectedUser.nombre} {selectedUser.apellido}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl theme-text-muted"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <select
              required
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className="mt-5 w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text"
            >
              <option value="">Selecciona un rol</option>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nombre}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void assignRole()}
              className="theme-button-dark mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold"
            >
              Asignar rol
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;




