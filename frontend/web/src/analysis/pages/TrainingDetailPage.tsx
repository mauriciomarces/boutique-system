import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AnalysisLayout from "../components/AnalysisLayout";
import {
  ConfusionMatrix,
  HorizontalBarChart,
} from "../components/Charts";
import { getTraining } from "../services/aiApi";
import type { TrainingSummary } from "../types/training.types";

function formatPct(value?: number) {
  if (
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function TrainingDetailPage() {
  const { id } = useParams<{
    id: string;
  }>();

  const [training, setTraining] =
    useState<TrainingSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError(
          "No se proporcionó el identificador del entrenamiento.",
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const result = await getTraining(id);

        if (cancelled) return;

        setTraining(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el entrenamiento.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const importances = training
    ? Object.entries(
        training.feature_importances || {},
      )
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({
          label,
          value,
        }))
    : [];

  /*
   * n_train y n_test existen en la respuesta real
   * del backend dentro de "metricas", pero todavía
   * no están declarados en training.types.ts.
   *
   * Se leen de forma segura sin modificar los tipos
   * globales del proyecto.
   */
    const trainingMetrics = training?.metricas as
    | {
        accuracy: number;
        precision: number;
        recall: number;
        f1_score: number;
        precision_por_clase?: Record<string, number>;
        recall_por_clase?: Record<string, number>;
        f1_por_clase?: Record<string, number>;
        confusion_matrix: number[][];
        n_train?: number;
        n_test?: number;
        }
    | undefined;

  return (
    <AnalysisLayout
      title="Detalle del entrenamiento"
      subtitle="Consulta de la configuración, resultados y evidencia registrada de una ejecución específica del modelo."
    >
      {loading && (
        <p className="theme-text-soft">
          Cargando información del entrenamiento…
        </p>
      )}

      {error && (
        <div className="rounded-2xl border theme-border bg-[#efc8d6]/30 px-4 py-4 theme-text">
          <p className="font-medium">
            No fue posible cargar el entrenamiento.
          </p>

          <p className="mt-1 text-sm">
            {error}
          </p>

          <Link
            to="/analisis/entrenamiento"
            className="mt-4 inline-block underline underline-offset-4"
          >
            Volver al historial
          </Link>
        </div>
      )}

      {!loading &&
        !error &&
        training && (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] theme-text-muted">
                  Identificador
                </p>

                <p className="mt-1 break-all text-sm font-medium theme-text">
                  {training.training_id}
                </p>
              </div>

              <Link
                to="/analisis/entrenamiento"
                className="inline-flex w-fit rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text"
              >
                Volver al historial
              </Link>
            </div>

            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Versión del modelo"
                value={training.model_version}
              />

              <Stat
                label="Dataset"
                value={training.dataset_version}
              />

              <Stat
                label="Algoritmo"
                value={training.algoritmo}
              />

              <Stat
                label="Estado"
                value={training.estado}
              />

              <Stat
                label="Registros"
                value={String(
                  training.cantidad_registros,
                )}
              />

              <Stat
                label="Características"
                value={String(
                  training.cantidad_features,
                )}
              />

              <Stat
                label="Fecha"
                value={new Date(
                  training.fecha,
                ).toLocaleString()}
              />

              <Stat
                label="Accuracy"
                value={formatPct(
                  training.accuracy,
                )}
              />

              <Stat
                label="Precision"
                value={formatPct(
                  training.precision,
                )}
              />

              <Stat
                label="Recall"
                value={formatPct(
                  training.recall,
                )}
              />

              <Stat
                label="F1-score"
                value={formatPct(
                  training.f1_score,
                )}
              />
            </section>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <section className="glass soft-shadow rounded-3xl p-6">
                <h2 className="mb-4 text-lg font-semibold theme-text">
                  Parámetros del modelo
                </h2>

                <div className="space-y-3">
                  {Object.entries(
                    training.parametros || {},
                  ).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4 border-b theme-border pb-3 last:border-b-0 last:pb-0"
                      >
                        <span className="text-sm theme-text-soft">
                          {key}
                        </span>

                        <span className="text-sm font-medium theme-text">
                          {String(value)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section className="glass soft-shadow rounded-3xl p-6">
                <h2 className="mb-4 text-lg font-semibold theme-text">
                  División del conjunto de datos
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Stat
                    label="Entrenamiento"
                    value={String(
                      trainingMetrics?.n_train ??
                        "—",
                    )}
                  />

                  <Stat
                    label="Prueba"
                    value={String(
                      trainingMetrics?.n_test ??
                        "—",
                    )}
                  />
                </div>
              </section>
            </div>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <section className="glass soft-shadow rounded-3xl p-6">
                <h2 className="mb-4 text-lg font-semibold theme-text">
                  Matriz de confusión
                </h2>

                <ConfusionMatrix
                  matrix={
                    training.confusion_matrix
                  }
                />
              </section>

              <section className="glass soft-shadow rounded-3xl p-6">
                <h2 className="mb-4 text-lg font-semibold theme-text">
                  Importancia de características
                </h2>

                <HorizontalBarChart
                  items={importances}
                />
              </section>
            </div>

            <section className="glass soft-shadow mb-6 rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Métricas por clase
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="theme-text-muted">
                      <th className="pb-3">
                        Clase
                      </th>

                      <th className="pb-3">
                        Precision
                      </th>

                      <th className="pb-3">
                        Recall
                      </th>

                      <th className="pb-3">
                        F1-score
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {["NORMAL", "ANOMALO"].map(
                      (label) => (
                        <tr
                          key={label}
                          className="border-t theme-border"
                        >
                          <td className="py-3 font-medium theme-text">
                            {label}
                          </td>

                          <td>
                            {formatPct(
                              training
                                .metricas
                                ?.precision_por_clase?.[
                                label
                              ],
                            )}
                          </td>

                          <td>
                            {formatPct(
                              training
                                .metricas
                                ?.recall_por_clase?.[
                                label
                              ],
                            )}
                          </td>

                          <td>
                            {formatPct(
                              training
                                .metricas
                                ?.f1_por_clase?.[
                                label
                              ],
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="glass soft-shadow mb-6 rounded-3xl p-6">
              <h2 className="mb-3 text-lg font-semibold theme-text">
                Archivos asociados
              </h2>

              <div className="space-y-3 text-sm">
                <InfoRow
                  label="Modelo"
                  value={
                    training.model_path ||
                    "No especificado"
                  }
                />

                <InfoRow
                  label="Dataset"
                  value={
                    training.dataset_path ||
                    "No especificado"
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl border theme-border bg-[var(--nav-bg)] p-6">
              <h2 className="mb-3 text-lg font-semibold theme-text">
                Observación académica
              </h2>

              <p className="text-sm leading-6 theme-text-soft">
                {training.nota ||
                  "No se registró una observación académica para esta ejecución."}
              </p>
            </section>
          </>
        )}
    </AnalysisLayout>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass soft-shadow rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] theme-text-muted">
        {label}
      </p>

      <p className="mt-2 break-words text-lg font-semibold theme-text">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border theme-border p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] theme-text-muted">
        {label}
      </p>

      <p className="mt-2 break-all font-mono text-xs theme-text">
        {value}
      </p>
    </div>
  );
}

export default TrainingDetailPage;