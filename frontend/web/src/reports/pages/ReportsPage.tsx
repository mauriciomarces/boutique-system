import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdministrationLayout from "../../administration/components/AdministrationLayout";
import LogoutButton from "../../auth/components/LogoutButton";
import PaginationControls, {
  usePagination,
} from "../../components/PaginationControls";
import {
  getDailyReport,
  getIncomeReport,
  getMonthlyReport,
  getSalesReport,
  type ReportType,
  type SalesReport,
} from "../services/reportsApi";

const reportOptions: Array<{ value: ReportType; label: string }> = [
  { value: "diario", label: "Reporte diario" },
  { value: "mensual", label: "Reporte mensual" },
  { value: "ventas", label: "Ventas" },
  { value: "ingresos", label: "Ingresos" },
  { value: "egresos", label: "Egresos" },
];

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  const firstNonSpace = [...text].find((character) => {
    const code = character.charCodeAt(0);
    return (
      code > 0x1f &&
      code !== 0x7f &&
      character !== "\uFEFF" &&
      !/\s/u.test(character)
    );
  });
  if (firstNonSpace && /^[=+\-@]$/.test(firstNonSpace)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  }).format(value ?? 0);
}

function reportTitle(type: ReportType) {
  return reportOptions.find((option) => option.value === type)?.label ?? "Reporte";
}

function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [type, setType] = useState<ReportType>("ventas");
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [from, setFrom] = useState(() => localDate(new Date()));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [saleId, setSaleId] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [requestState, setRequestState] = useState<{
    key: string;
    report?: SalesReport;
    error?: string;
  } | null>(null);
  const queryKey = JSON.stringify([
    type,
    selectedDate,
    from,
    to,
    status,
    clientId,
    clientName,
    saleId,
    minAmount,
    maxAmount,
    paymentStatus,
    paymentMethod,
    refreshKey,
  ]);
  const currentRequest =
    requestState?.key === queryKey ? requestState : null;
  const report = currentRequest?.report ?? null;
  const error = currentRequest?.error ?? "";
  const loading = type !== "egresos" && currentRequest === null;
  const operationsPagination = usePagination(report?.operaciones ?? []);
  const setOperationsPage = operationsPagination.setPage;
  const filterSummary = [
    `estado ${status || "Todos"}`,
    `cliente ID ${clientId || "Todos"}`,
    `cliente ${clientName || "Todos"}`,
    `venta ID ${saleId || "Todas"}`,
    `importe ${minAmount || "0"}–${maxAmount || "sin máximo"} Bs`,
    `estado de pago ${paymentStatus || "Todos"}`,
    `método ${paymentMethod || "Todos"}`,
  ].join("; ");

  useEffect(() => {
    setOperationsPage(1);
    if (type === "egresos") return;

    let cancelled = false;
    const request =
      type === "diario"
        ? getDailyReport(selectedDate)
        : type === "mensual"
          ? getMonthlyReport(
              Number(selectedDate.slice(5, 7)),
              Number(selectedDate.slice(0, 4)),
            )
          : type === "ventas"
            ? getSalesReport(from, to, {
                status,
                clientId,
                clientName,
                saleId,
                minAmount,
                maxAmount,
                paymentStatus,
                paymentMethod,
              })
            : getIncomeReport(from, to);

    request
      .then((result) => {
        if (!cancelled) setRequestState({ key: queryKey, report: result });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRequestState({
            key: queryKey,
            error:
              cause instanceof Error
                ? cause.message
                : "No se pudo consultar el reporte.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    type,
    selectedDate,
    from,
    to,
    status,
    clientId,
    clientName,
    saleId,
    minAmount,
    maxAmount,
    paymentStatus,
    paymentMethod,
    refreshKey,
    queryKey,
    setOperationsPage,
  ]);

  const periodLabel = useMemo(() => {
    if (type === "diario") return selectedDate;
    if (type === "mensual") return selectedDate.slice(0, 7);
    return `${from} a ${to}${type === "ventas" && status ? ` · ${status}` : ""}`;
  }, [from, selectedDate, status, to, type]);

  const exportCsv = () => {
    if (!report) return;
    const operationRows = [
      [
        "Número de venta",
        "Fecha",
        "Cliente",
        "Usuario responsable",
        "Importe de la venta",
        "Estado",
        "Pagos recibidos",
        "Métodos de pago",
      ],
      ...report.operaciones.map((operation) => [
        operation.id,
        new Date(operation.fecha).toLocaleString("es-BO"),
        operation.cliente ?? "",
        operation.responsable ?? "No disponible",
        operation.importe.toFixed(2),
        operation.estado,
        operation.pagosRecibidos.toFixed(2),
        operation.metodosPago.join("; "),
      ]),
    ];
    const summaryRows =
      type === "ingresos"
        ? [
            ["Ingresos por ventas válidas", (report.ingresosPorVentas ?? 0).toFixed(2)],
            ["Pagos recibidos registrados", (report.pagosRecibidos ?? 0).toFixed(2)],
          ]
        : [
            ["Ventas registradas", String(report.ventasRegistradas ?? 0)],
            ["Ventas válidas", String(report.cantidadVentas ?? 0)],
            ["Ventas canceladas", String(report.ventasCanceladas ?? 0)],
            ["Ingresos por ventas válidas", (report.ingresosPorVentas ?? 0).toFixed(2)],
            ...(report.pagosRecibidos === undefined
              ? []
              : [["Pagos recibidos registrados", report.pagosRecibidos.toFixed(2)]]),
          ];
    const rows: unknown[][] = [
      [`Reporte: ${reportTitle(type)}`],
      [`Período consultado: ${periodLabel}`],
      ...(type === "ventas"
        ? [[`Filtros: ${filterSummary}`]]
        : []),
      [],
      ["Resumen"],
      ["Indicador", "Valor"],
      ...summaryRows,
      [],
      ["Operaciones"],
      ...operationRows,
    ];
    if (type === "mensual" && report.resumenPorDia) {
      rows.push(
        [],
        ["Resumen por día"],
        [
          "Fecha",
          "Ventas válidas",
          "Ventas registradas",
          "Ventas canceladas",
          "Ingresos por ventas",
        ],
        ...report.resumenPorDia.map((day) => [
          day.fecha,
          String(day.cantidadVentas),
          String(day.ventasRegistradas),
          String(day.ventasCanceladas),
          day.ingresosPorVentas.toFixed(2),
        ]),
      );
    }
    if (type === "ingresos" && report.desglosePorDia) {
      rows.push(
        [],
        ["Desglose de ingresos por día"],
        ["Fecha", "Ingresos por ventas", "Pagos recibidos"],
        ...report.desglosePorDia.map((day) => [
          day.fecha,
          day.ingresosPorVentas.toFixed(2),
          day.pagosRecibidos.toFixed(2),
        ]),
      );
    }
    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reporte-${type}-${periodLabel.replace(/[^0-9-]/g, "_")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPdf = () => window.print();

  const dailySummary =
    type === "diario" ? report : null;
  const monthlySummary =
    type === "mensual" ? report : null;

  return (
    <AdministrationLayout
      sidebarOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    >
      <style>{`
        @page { size: landscape; margin: 14mm; }
        @media print {
          body { background: white !important; color: black !important; }
          aside, .report-navigation, .report-actions, .report-filters, .pagination-controls { display: none !important; }
          .report-operations-screen { display: none !important; }
          .report-operations-print { display: block !important; }
          .report-print { display: block !important; color: black !important; }
          .report-print table { width: 100%; border-collapse: collapse; }
          .report-print th, .report-print td { border: 1px solid #bbb; padding: 6px; font-size: 10px; }
          .report-print thead { display: table-header-group; }
          .report-print tr { break-inside: avoid; }
        }
      `}</style>
      <main className="min-w-0 flex-1 p-6 lg:p-10">
        <div className="report-navigation flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border theme-border px-4 py-2 text-sm theme-text lg:hidden"
          >
            Menú
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/panel" className="text-sm theme-text-soft hover:underline">
              Panel
            </Link>
            <LogoutButton />
          </div>
        </div>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">
            Análisis comercial
          </p>
          <h1 className="mt-2 text-3xl font-semibold theme-text">Reportes</h1>
          <p className="mt-2 text-sm theme-text-soft">
            Datos reales de ventas y pagos. Los pagos recibidos se muestran por separado
            del importe total de las ventas.
          </p>
        </header>

        <section className="report-filters glass soft-shadow mt-7 rounded-2xl p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm theme-text">
              Tipo de reporte
              <select
                value={type}
                onChange={(event) => setType(event.target.value as ReportType)}
                className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
              >
                {reportOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {type === "diario" || type === "mensual" ? (
              <label className="text-sm theme-text">
                {type === "diario" ? "Fecha" : "Mes de consulta"}
                <input
                  type={type === "diario" ? "date" : "month"}
                  value={type === "diario" ? selectedDate : selectedDate.slice(0, 7)}
                  onChange={(event) =>
                    setSelectedDate(
                      type === "diario"
                        ? event.target.value
                        : `${event.target.value}-01`,
                    )
                  }
                  className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                />
              </label>
            ) : type !== "egresos" ? (
              <>
                <label className="text-sm theme-text">
                  Desde
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                  />
                </label>
                <label className="text-sm theme-text">
                  Hasta
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                  />
                </label>
                {type === "ventas" && (
                  <>
                    <label className="text-sm theme-text">
                      Estado de venta
                      <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      >
                        <option value="">Todos</option>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="CONFIRMADA">Confirmada</option>
                        <option value="ANULADA">Anulada</option>
                      </select>
                    </label>
                    <label className="text-sm theme-text">
                      ID del cliente
                      <input
                        inputMode="numeric"
                        value={clientId}
                        onChange={(event) => setClientId(event.target.value.replace(/\D/g, ""))}
                        placeholder="Todos"
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="text-sm theme-text">
                      Nombre o apellido del cliente
                      <input
                        value={clientName}
                        onChange={(event) => setClientName(event.target.value)}
                        maxLength={100}
                        placeholder="Buscar por nombre"
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="text-sm theme-text">
                      ID de venta
                      <input
                        inputMode="numeric"
                        value={saleId}
                        onChange={(event) => setSaleId(event.target.value.replace(/\D/g, ""))}
                        placeholder="Todas"
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="text-sm theme-text">
                      Importe mínimo (Bs)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={minAmount}
                        onChange={(event) => setMinAmount(event.target.value)}
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="text-sm theme-text">
                      Importe máximo (Bs)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={maxAmount}
                        onChange={(event) => setMaxAmount(event.target.value)}
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="text-sm theme-text">
                      Estado del pago
                      <select
                        value={paymentStatus}
                        onChange={(event) => setPaymentStatus(event.target.value)}
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      >
                        <option value="">Todos</option>
                        <option value="PAGADO">Pagado</option>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="ANULADO">Anulado</option>
                      </select>
                    </label>
                    <label className="text-sm theme-text">
                      Método de pago
                      <input
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                        maxLength={50}
                        placeholder="Ej. EFECTIVO"
                        className="mt-2 w-full rounded-xl border theme-border bg-transparent px-3 py-2"
                      />
                    </label>
                  </>
                )}
              </>
            ) : null}
          </div>
          <div className="report-actions mt-4 flex flex-wrap gap-3">
            {type !== "egresos" && (
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className="theme-button-dark rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Actualizar reporte
              </button>
            )}
            {report && type !== "egresos" && (
              <>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
                >
                  Exportar PDF
                </button>
              </>
            )}
          </div>
        </section>

        {loading && <p className="mt-6 theme-text-soft">Consultando datos reales...</p>}
        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {type === "egresos" && (
          <div className="mt-6 rounded-2xl border theme-border p-5 text-sm theme-text-soft">
            El sistema no registra gastos ni egresos monetarios independientes. Las compras
            e inventario no se contabilizan como egresos pagados porque no existe un registro
            de pagos de proveedores que confirme ese flujo económico.
          </div>
        )}

        {report && type !== "egresos" && (
          <section className="report-print glass soft-shadow mt-7 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  {reportTitle(type)}
                </h2>
                <p className="mt-1 text-sm theme-text-soft">
                  Período consultado: {periodLabel}
                </p>
                {type === "ventas" && (
                  <p className="text-sm theme-text-soft">
                    Filtros: {filterSummary}
                  </p>
                )}
                <p className="text-xs theme-text-muted">
                  Generado: {new Date().toLocaleString("es-MX")}
                </p>
              </div>
              <button
                type="button"
                onClick={exportPdf}
                className="report-actions rounded-xl border theme-border px-3 py-2 text-sm theme-text"
              >
                Imprimir / Guardar PDF
              </button>
            </div>

            {type !== "ingresos" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Ventas válidas" value={String(report.cantidadVentas ?? 0)} />
                <Metric label="Ventas registradas" value={String(report.ventasRegistradas ?? 0)} />
                <Metric label="Ventas canceladas" value={String(report.ventasCanceladas ?? 0)} />
                <Metric label="Ingresos por ventas" value={formatCurrency(report.ingresosPorVentas)} />
              </div>
            )}
            {type === "ingresos" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Ingresos derivados de ventas válidas"
                  value={formatCurrency(report.ingresosPorVentas)}
                />
                <Metric
                  label="Pagos efectivamente recibidos"
                  value={formatCurrency(report.pagosRecibidos)}
                />
              </div>
            )}
            {(type === "diario" || type === "mensual" || type === "ingresos") && (
              <div className="mt-4 rounded-xl bg-[var(--bg-secondary)] p-4 text-sm theme-text">
                Pagos recibidos registrados: <strong>{formatCurrency(report.pagosRecibidos)}</strong>
                <span className="ml-1 theme-text-soft">
                  (dato distinto al total de ventas; solo pagos con estado PAGADO)
                </span>
              </div>
            )}

            {monthlySummary?.resumenPorDia && (
              <div className="mt-6">
                <h3 className="font-semibold theme-text">Resumen por día</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b theme-border theme-text-muted">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Ventas válidas</th>
                        <th className="px-3 py-2">Registradas</th>
                        <th className="px-3 py-2">Canceladas</th>
                        <th className="px-3 py-2">Ingresos por ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.resumenPorDia.map((day) => (
                        <tr key={day.fecha} className="border-b theme-border theme-text">
                          <td className="px-3 py-2">{day.fecha}</td>
                          <td className="px-3 py-2">{day.cantidadVentas}</td>
                          <td className="px-3 py-2">{day.ventasRegistradas}</td>
                          <td className="px-3 py-2">{day.ventasCanceladas}</td>
                          <td className="px-3 py-2">{formatCurrency(day.ingresosPorVentas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {type === "ingresos" && report.desglosePorDia && (
              <div className="mt-6">
                <h3 className="font-semibold theme-text">Desglose por día</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b theme-border theme-text-muted">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Ingresos por ventas</th>
                        <th className="px-3 py-2">Pagos recibidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.desglosePorDia.map((day) => (
                        <tr key={day.fecha} className="border-b theme-border theme-text">
                          <td className="px-3 py-2">{day.fecha}</td>
                          <td className="px-3 py-2">{formatCurrency(day.ingresosPorVentas)}</td>
                          <td className="px-3 py-2">{formatCurrency(day.pagosRecibidos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-semibold theme-text">Operaciones</h3>
              <div className="report-operations-screen mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b theme-border theme-text-muted">
                      <th className="px-3 py-2">Número</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Responsable</th>
                      <th className="px-3 py-2">Importe</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Pagos recibidos</th>
                      <th className="px-3 py-2">Método(s) de pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationsPagination.pageItems.map((operation) => (
                      <tr key={operation.id} className="border-b theme-border theme-text">
                        <td className="px-3 py-2">{operation.id}</td>
                        <td className="px-3 py-2">{new Date(operation.fecha).toLocaleString("es-BO")}</td>
                        <td className="px-3 py-2">{operation.cliente || "Sin cliente"}</td>
                        <td className="px-3 py-2">{operation.responsable || "No disponible"}</td>
                        <td className="px-3 py-2">{formatCurrency(operation.importe)}</td>
                        <td className="px-3 py-2">{operation.estado}</td>
                        <td className="px-3 py-2">{formatCurrency(operation.pagosRecibidos)}</td>
                        <td className="px-3 py-2">{operation.metodosPago.join(", ") || "Sin pagos"}</td>
                      </tr>
                    ))}
                    {report.operaciones.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center theme-text-soft">
                          No hay ventas para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="report-operations-print mt-3 overflow-x-auto" style={{ display: "none" }}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b theme-border theme-text-muted">
                      <th className="px-3 py-2">Número</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Responsable</th>
                      <th className="px-3 py-2">Importe</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Pagos recibidos</th>
                      <th className="px-3 py-2">Método(s) de pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.operaciones.map((operation) => (
                      <tr key={operation.id} className="border-b theme-border theme-text">
                        <td className="px-3 py-2">{operation.id}</td>
                        <td className="px-3 py-2">{new Date(operation.fecha).toLocaleString("es-BO")}</td>
                        <td className="px-3 py-2">{operation.cliente || "Sin cliente"}</td>
                        <td className="px-3 py-2">{operation.responsable || "No disponible"}</td>
                        <td className="px-3 py-2">{formatCurrency(operation.importe)}</td>
                        <td className="px-3 py-2">{operation.estado}</td>
                        <td className="px-3 py-2">{formatCurrency(operation.pagosRecibidos)}</td>
                        <td className="px-3 py-2">{operation.metodosPago.join(", ") || "Sin pagos"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={operationsPagination.page}
                pageCount={operationsPagination.pageCount}
                pageSize={operationsPagination.pageSize}
                total={operationsPagination.total}
                onPageChange={operationsPagination.setPage}
                onPageSizeChange={operationsPagination.setPageSize}
              />
            </div>
            {dailySummary && (
              <p className="mt-4 text-xs theme-text-muted">
                La cantidad de ventas e ingresos por ventas excluye operaciones canceladas.
              </p>
            )}
          </section>
        )}
      </main>
    </AdministrationLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-secondary)] p-4">
      <p className="text-xs theme-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold theme-text">{value}</p>
    </div>
  );
}

export default ReportsPage;
