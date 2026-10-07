import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";

import type {
  Client,
  ClientForm,
} from "../types/clients.types";

import {
  changeClientStatus,
  createClient,
  getClients,
  updateClient,
} from "../services/clientsApi";

import {
  normalizeClientForm,
  validateClientForm,
  type ClientFormErrors,
} from "../utils/clientsValidation";

function sanitizeClientName(value: string): string {
  return value
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s+/g, " ");
}
const EMPTY_FORM: ClientForm = {
  nombre: "",
  apellido: "",
  telefono: "",
  correo: "",
};

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState<
    "create" | "edit" | null
  >(null);

  const [selectedClient, setSelectedClient] =
    useState<Client | null>(null);

  const [form, setForm] =
    useState<ClientForm>(EMPTY_FORM);

  const [fieldErrors, setFieldErrors] =
    useState<ClientFormErrors>({});

  const loadClients = async (term = search) => {
    setLoading(true);
    setError("");

    try {
      const data = await getClients(term);
      setClients(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los clientes.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClients("");
  }, []);

  const visibleClients = useMemo(() => {
    return clients;
  }, [clients]);

  const openCreate = () => {
    setError("");
    setNotice("");
    setSelectedClient(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModal("create");
  };

  const openEdit = (client: Client) => {
    setError("");
    setNotice("");
    setSelectedClient(client);

    const clientForm: ClientForm = {
      nombre: client.nombre,
      apellido: client.apellido,
      telefono: client.telefono || "",
      correo: client.correo || "",
    };

    setForm(clientForm);
    setFieldErrors({});
    setModal("edit");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelectedClient(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
  };

  const handleFieldBlur = () => {
    const normalized = normalizeClientForm(form);

    setForm(normalized);
    setFieldErrors(validateClientForm(normalized));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setNotice("");

    const normalizedForm = normalizeClientForm(form);
    const validationErrors =
      validateClientForm(normalizedForm);

    setForm(normalizedForm);
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!modal) {
      return;
    }

    setSaving(true);

    try {
      if (modal === "create") {
        await createClient(normalizedForm);
        setNotice("Cliente creado correctamente.");
      } else if (
        modal === "edit" &&
        selectedClient
      ) {
        await updateClient(
          selectedClient.id,
          normalizedForm,
        );

        setNotice("Cliente actualizado correctamente.");
      }

      setModal(null);
      setSelectedClient(null);
      setForm(EMPTY_FORM);
      setFieldErrors({});

      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el cliente.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (client: Client) => {
    setError("");
    setNotice("");

    try {
      const nextStatus =
        client.estado === "ACTIVO"
          ? "INACTIVO"
          : "ACTIVO";

      await changeClientStatus(
        client.id,
        nextStatus,
      );

      setNotice(
        nextStatus === "ACTIVO"
          ? "Cliente activado correctamente."
          : "Cliente desactivado correctamente.",
      );

      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado del cliente.",
      );
    }
  };

  const handleSearch = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    await loadClients(search);
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="theme-bg min-h-screen">
      <header className="border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border theme-border bg-[var(--bg)] theme-text shadow-lg lg:hidden"
              aria-label="Abrir menú de administración"
              aria-expanded={sidebarOpen}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <Link to="/" className="theme-text">
              <p className="text-sm font-semibold tracking-[0.08em]">
                BOUTIQUE SPOSABELLA
              </p>

              <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
                Centro de gestión
              </p>
            </Link>
          </div>

          <Link
            to="/administracion"
            className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
          >
            Administración
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdministrationSidebar
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
                Gestión comercial
              </p>

              <h1 className="mt-2 text-3xl font-semibold theme-text">
                Clientes
              </h1>

              <p className="mt-2 theme-text-soft">
                Registra y administra la información
                de los clientes de la boutique.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
            >
              + Nuevo cliente
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 text-lg font-semibold leading-none text-red-500"
                aria-label="Cerrar mensaje de error"
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
                className="shrink-0 text-lg font-semibold leading-none text-green-600"
                aria-label="Cerrar mensaje"
              >
                ×
              </button>
            </div>
          )}

          <section className="glass soft-shadow overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-4 border-b theme-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold theme-text">
                  Directorio de clientes
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  {visibleClients.length} clientes encontrados
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex w-full gap-2 sm:w-auto"
              >
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar cliente"
                  className="w-full rounded-xl border theme-border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm theme-text sm:w-72"
                />

                <button
                  type="submit"
                  className="rounded-xl border theme-border px-4 py-2.5 text-sm font-semibold theme-text"
                >
                  Buscar
                </button>
              </form>
            </div>

            {loading ? (
              <div className="p-8 text-sm theme-text-soft">
                Cargando clientes...
              </div>
            ) : visibleClients.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-medium theme-text">
                  No se encontraron clientes
                </p>

                <p className="mt-2 text-sm theme-text-soft">
                  Registra un cliente nuevo o cambia
                  el criterio de búsqueda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--bg-secondary)] theme-text-soft">
                    <tr>
                      <th className="px-5 py-4 font-medium">
                        Cliente
                      </th>

                      <th className="px-5 py-4 font-medium">
                        Contacto
                      </th>

                      <th className="px-5 py-4 font-medium">
                        Estado
                      </th>

                      <th className="px-5 py-4 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleClients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-t theme-border"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium theme-text">
                            {client.nombre}{" "}
                            {client.apellido}
                          </p>

                          <p className="mt-1 text-xs theme-text-muted">
                            ID #{client.id}
                          </p>
                        </td>

                        <td className="px-5 py-4 theme-text-soft">
                          <p>
                            {client.correo ||
                              "Sin correo"}
                          </p>

                          <p className="mt-1 text-xs">
                            {client.telefono ||
                              "Sin teléfono"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              client.estado === "ACTIVO"
                                ? "bg-[#e9f6ef] text-[#47745f]"
                                : "bg-[#f7e7e7] text-[#9c5c5c]"
                            }`}
                          >
                            {client.estado}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(client)
                              }
                              className="rounded-lg border theme-border px-3 py-1.5 text-xs font-semibold theme-text"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleStatus(
                                  client,
                                )
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                client.estado ===
                                "ACTIVO"
                                  ? "border-[#d49a9a] text-[#9c5c5c]"
                                  : "border-[#6cad91] text-[#47745f]"
                              }`}
                            >
                              {client.estado ===
                              "ACTIVO"
                                ? "Desactivar"
                                : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl border theme-border bg-[var(--bg)] p-6 shadow-2xl"
            noValidate
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  {modal === "create"
                    ? "Nuevo cliente"
                    : "Editar cliente"}
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  {modal === "create"
                    ? "Registra la información básica del cliente."
                    : "Actualiza la información del cliente."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="text-2xl theme-text-muted disabled:opacity-40"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="client-nombre"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Nombre
                </label>

                <input
                  id="client-nombre"
                  required
                  value={form.nombre}
                  maxLength={100}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nombre: sanitizeClientName(event.target.value),
                    }))
                  }
                  onBlur={handleFieldBlur}
                  placeholder="Nombre"
                  className={`w-full rounded-xl border ${
                    fieldErrors.nombre
                      ? "border-red-400"
                      : "theme-border"
                  } bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text`}
                  aria-invalid={Boolean(fieldErrors.nombre)}
                />

                {fieldErrors.nombre && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.nombre}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="client-apellido"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Apellido
                </label>

                <input
                  id="client-apellido"
                  required
                  value={form.apellido}
                  maxLength={100}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      apellido: sanitizeClientName(event.target.value),
                    }))
                  }
                  onBlur={handleFieldBlur}
                  placeholder="Apellido"
                  className={`w-full rounded-xl border ${
                    fieldErrors.apellido
                      ? "border-red-400"
                      : "theme-border"
                  } bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text`}
                  aria-invalid={Boolean(fieldErrors.apellido)}
                />

                {fieldErrors.apellido && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.apellido}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="client-correo"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Correo electrónico
                </label>

                <input
                  id="client-correo"
                  type="email"
                  value={form.correo}
                  maxLength={150}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      correo: event.target.value,
                    }))
                  }
                  onBlur={handleFieldBlur}
                  placeholder="Correo electrónico"
                  className={`w-full rounded-xl border ${
                    fieldErrors.correo
                      ? "border-red-400"
                      : "theme-border"
                  } bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text`}
                  aria-invalid={Boolean(fieldErrors.correo)}
                />

                {fieldErrors.correo && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.correo}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="client-telefono"
                  className="mb-1.5 block text-sm font-medium theme-text"
                >
                  Teléfono
                </label>

                <input
                  id="client-telefono"
                  value={form.telefono}
                  inputMode="numeric"
                  maxLength={9}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telefono: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 9),
                    }))
                  }
                  onBlur={handleFieldBlur}
                  placeholder="Teléfono"
                  className={`w-full rounded-xl border ${
                    fieldErrors.telefono
                      ? "border-red-400"
                      : "theme-border"
                  } bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text`}
                  aria-invalid={Boolean(fieldErrors.telefono)}
                />

                {fieldErrors.telefono && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.telefono}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border theme-border px-4 py-3 text-sm theme-text disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="theme-button-dark rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {saving
                  ? "Guardando..."
                  : modal === "create"
                    ? "Crear cliente"
                    : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ClientsPage;

