import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnalysisLayout from "../components/AnalysisLayout";
import {
  ConfusionMatrix,
  HorizontalBarChart,
  MetricsTrend,
} from "../components/Charts";
import {
  getCurrentModel,
  listTrainings,
} from "../services/aiApi";
import type {
  ModelMetadata,
  TrainingSummary,
} from "../types/training.types";

function formatPct(value?: number) {
  if (
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

interface V3EvaluationReport {
  dataset_version: string;
  dataset_kind: string;
  generated_at_utc: string;
  label_caveat: string;
  audit: {
    cases: number;
    feature_count: number;
    features: string[];
    missing_required_values: number;
    duplicate_feature_vectors: number;
    contradictory_feature_vectors: number;
    class_counts: Record<string, number>;
  };
  grouped_cross_validation: {
    method: string;
    folds: number;
    tree: {
      casos: number;
      accuracy: number;
      balanced_accuracy: number;
      precision_anomalia: number;
      recall_anomalia: number;
      f1_anomalia: number;
      matriz_confusion: number[][];
    };
    baseline: {
      casos: number;
      accuracy: number;
      balanced_accuracy: number;
      precision_anomalia: number;
      recall_anomalia: number;
      f1_anomalia: number;
      matriz_confusion: number[][];
    };
  };
  unseen_family_holdout: {
    test_families: string[];
    train_cases: number;
    test_cases: number;
    tree: {
      casos: number;
      accuracy: number;
      balanced_accuracy: number;
      precision_anomalia: number;
      recall_anomalia: number;
      f1_anomalia: number;
      matriz_confusion: number[][];
    };
    per_family: Record<string, {
      casos: number;
      accuracy: number;
      balanced_accuracy: number;
      precision_anomalia: number;
      recall_anomalia: number;
      f1_anomalia: number;
      matriz_confusion: number[][];
    }>;
  };
}
function TrainingDashboardPage() {
  const [trainings, setTrainings] = useState<
    TrainingSummary[]
  >([]);

  const [model, setModel] =
    useState<ModelMetadata | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [experimental, setExperimental] =
    useState<V3EvaluationReport | null>(null);
  const [experimentalError, setExperimentalError] =
    useState("");
  const [emptyMessage, setEmptyMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadExperimentalReport() {
      try {
        const reportUrl =
          `${import.meta.env.BASE_URL}data/v3-evaluation.json`;
        const response = await fetch(reportUrl);

        if (!response.ok) {
          throw new Error(
            `No se pudo cargar el informe V3 (${response.status}).`,
          );
        }

        const report =
          await response.json() as V3EvaluationReport;

        if (!cancelled) {
          setExperimental(report);
          setExperimentalError("");
        }
      } catch (err) {
        if (!cancelled) {
          setExperimentalError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la evaluación experimental V3.",
          );
        }
      }
    }

    void loadExperimentalReport();

    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setEmptyMessage("");

        const history = await listTrainings();

        if (cancelled) return;

        setTrainings(history);

        if (!history.length) {
          setEmptyMessage(
            "No existen entrenamientos registrados.",
          );
          setModel(null);
          return;
        }

        const current =
          await getCurrentModel().catch(() => null);

        if (cancelled) return;

        setModel(current);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el historial de entrenamiento.",
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
  }, []);

  const latest = trainings[0];

  const importances = useMemo(() => {
    const source =
      model?.feature_importances ||
      latest?.feature_importances ||
      {};

    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({
        label,
        value,
      }));
  }, [latest, model]);

  const trend = useMemo(
    () =>
      [...trainings]
        .reverse()
        .map((item) => ({
          version: item.model_version,
          accuracy: item.accuracy,
          precision: item.precision,
          recall: item.recall,
          f1: item.f1_score,
        })),
    [trainings],
  );

  return (
    <AnalysisLayout
      title="Entrenamiento del modelo"
      subtitle="Evidencia experimental del Árbol de Decisión. Las métricas provienen de ai-service y corresponden a ejecuciones registradas."
    >
      {loading && (
        <p className="theme-text-soft">
          Cargando entrenamientos…
        </p>
      )}

      {error && (
        <p className="rounded-2xl border theme-border bg-[#efc8d6]/30 px-4 py-3 text-sm theme-text">
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        emptyMessage && (
          <div className="glass soft-shadow rounded-3xl p-8">
            <p className="text-lg theme-text">
              {emptyMessage}
            </p>

            <p className="mt-2 text-sm theme-text-soft">
              Genere el dataset y ejecute un
              entrenamiento explícito en ai-service
              para registrar una nueva iteración.
            </p>
          </div>
        )}

      <section className="glass soft-shadow mb-6 rounded-3xl p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold theme-text">
            Evaluación experimental V3
          </h2>
          <p className="mt-2 text-sm theme-text-soft">
            Evaluación independiente del modelo operativo publicado,
            realizada con casos sintéticos y validación agrupada.
          </p>
        </div>

        {experimentalError && (
          <p className="mb-4 rounded-2xl border theme-border px-4 py-3 text-sm theme-text">
            {experimentalError}
          </p>
        )}

        {!experimental && !experimentalError && (
          <p className="text-sm theme-text-soft">
            Cargando informe experimental…
          </p>
        )}

        {experimental && (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Casos sintéticos"
                value={String(experimental.audit.cases)}
              />
              <Stat
                label="Variables"
                value={String(experimental.audit.feature_count)}
              />
              <Stat
                label="Accuracy CV"
                value={formatPct(experimental.grouped_cross_validation.tree.accuracy)}
              />
              <Stat
                label="Balanced accuracy CV"
                value={formatPct(experimental.grouped_cross_validation.tree.balanced_accuracy)}
              />
              <Stat
                label="Precision de anomalías CV"
                value={formatPct(experimental.grouped_cross_validation.tree.precision_anomalia)}
              />
              <Stat
                label="Recall de anomalías CV"
                value={formatPct(experimental.grouped_cross_validation.tree.recall_anomalia)}
              />
              <Stat
                label="F1 de anomalías CV"
                value={formatPct(experimental.grouped_cross_validation.tree.f1_anomalia)}
              />
              <Stat
                label="Pliegues de validación"
                value={String(experimental.grouped_cross_validation.folds)}
              />
            </div>

            <p className="mb-5 text-xs theme-text-soft">
              Método: {experimental.grouped_cross_validation.method}.
              Dataset: {experimental.dataset_version}.
              Generado: {new Date(experimental.generated_at_utc).toLocaleString()}.
            </p>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border theme-border p-4">
                <h3 className="mb-2 font-semibold theme-text">
                  Árbol de Decisión: validación cruzada
                </h3>
                <p className="mb-3 text-sm theme-text-soft">
                  Matriz de confusión del conjunto de predicciones fuera de pliegue.
                </p>
                <ConfusionMatrix
                  matrix={experimental.grouped_cross_validation.tree.matriz_confusion}
                />
              </div>

              <div className="rounded-2xl border theme-border p-4">
                <h3 className="mb-2 font-semibold theme-text">
                  Baseline: clase mayoritaria
                </h3>
                <p className="mb-3 text-sm theme-text-soft">
                  Modelo de referencia que predice la clase más frecuente.
                </p>
                <ConfusionMatrix
                  matrix={experimental.grouped_cross_validation.baseline.matriz_confusion}
                />
                <div className="mt-3 text-sm theme-text-soft">
                  Accuracy: {formatPct(experimental.grouped_cross_validation.baseline.accuracy)}
                  {" · "}
                  Recall de anomalías: {formatPct(experimental.grouped_cross_validation.baseline.recall_anomalia)}
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border theme-border p-4">
              <h3 className="mb-2 font-semibold theme-text">
                Evaluación con familias reservadas
              </h3>
              <p className="mb-4 text-sm theme-text-soft">
                Entrenamiento: {experimental.unseen_family_holdout.train_cases} casos.
                Prueba: {experimental.unseen_family_holdout.test_cases} casos.
                Familias: {experimental.unseen_family_holdout.test_families.join(", ")}.
              </p>

              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Accuracy"
                  value={formatPct(experimental.unseen_family_holdout.tree.accuracy)}
                />
                <Stat
                  label="Balanced accuracy"
                  value={formatPct(experimental.unseen_family_holdout.tree.balanced_accuracy)}
                />
                <Stat
                  label="Recall de anomalías"
                  value={formatPct(experimental.unseen_family_holdout.tree.recall_anomalia)}
                />
              </div>

              <h4 className="mb-2 font-medium theme-text">
                Matriz de confusión
              </h4>
              <ConfusionMatrix
                matrix={experimental.unseen_family_holdout.tree.matriz_confusion}
              />

              <h4 className="mt-5 mb-2 font-medium theme-text">
                Resultados por familia
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="theme-text-muted">
                      <th className="pb-2">Familia</th>
                      <th className="pb-2">Casos</th>
                      <th className="pb-2">Accuracy</th>
                      <th className="pb-2">Recall anomalías</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      experimental.unseen_family_holdout.per_family,
                    ).map(([family, result]) => (
                      <tr key={family} className="border-t theme-border">
                        <td className="py-2">{family}</td>
                        <td>{result.casos}</td>
                        <td>{formatPct(result.accuracy)}</td>
                        <td>{formatPct(result.recall_anomalia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>


          </>
        )}
      </section>
      {!loading && latest && (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Modelo actual"
              value={
                model?.model_version ||
                latest.model_version
              }
            />

            <Stat
              label="Dataset"
              value={
                model?.dataset_version ||
                latest.dataset_version
              }
            />

            <Stat
              label="Fecha"
              value={new Date(
                model?.fecha_entrenamiento ||
                  latest.fecha,
              ).toLocaleString()}
            />

            <Stat
              label="Algoritmo"
              value={
                model?.algoritmo ||
                latest.algoritmo
              }
            />

            <Stat
              label="Registros"
              value={String(
                model?.cantidad_registros ||
                  latest.cantidad_registros,
              )}
            />

            <Stat
              label="Características"
              value={String(
                model?.cantidad_features ||
                  latest.cantidad_features,
              )}
            />

            <Stat
              label="Accuracy"
              value={formatPct(
                latest.accuracy,
              )}
            />

            <Stat
              label="Precision"
              value={formatPct(
                latest.precision,
              )}
            />

            <Stat
              label="Recall"
              value={formatPct(
                latest.recall,
              )}
            />

            <Stat
              label="F1-score"
              value={formatPct(
                latest.f1_score,
              )}
            />
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Matriz de confusión
              </h2>

              <ConfusionMatrix
                matrix={
                  latest.confusion_matrix
                }
              />
            </div>

            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Importancia de características
              </h2>

              <HorizontalBarChart
                items={importances}
              />
            </div>
          </div>

          <div className="glass soft-shadow mb-6 rounded-3xl p-6">
            <h2 className="mb-2 text-lg font-semibold theme-text">
              Evolución entre iteraciones
            </h2>

            <p className="mb-4 text-xs theme-text-muted">
              Accuracy · F1 · Precision · Recall
            </p>

            <MetricsTrend points={trend} />
          </div>

          <div className="glass soft-shadow rounded-3xl p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold theme-text">
                  Historial de entrenamientos
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  Cada ejecución se conserva como una
                  iteración independiente del modelo.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="theme-text-muted">
                    <th className="pb-3">
                      ID
                    </th>

                    <th className="pb-3">
                      Versión
                    </th>

                    <th className="pb-3">
                      Dataset
                    </th>

                    <th className="pb-3">
                      Registros
                    </th>

                    <th className="pb-3">
                      Accuracy
                    </th>

                    <th className="pb-3">
                      F1
                    </th>

                    <th className="pb-3">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {trainings.map((item) => (
                    <tr
                      key={item.training_id}
                      className="border-t theme-border"
                    >
                      <td className="py-3">
                        <Link
                          className="font-medium underline decoration-[#d9cdeb] underline-offset-4"
                          to={`/analisis/entrenamiento/${item.training_id}`}
                        >
                          Ver detalle
                        </Link>
                      </td>

                      <td>
                        {item.model_version}
                      </td>

                      <td>
                        {item.dataset_version}
                      </td>

                      <td>
                        {item.cantidad_registros}
                      </td>

                      <td>
                        {formatPct(
                          item.accuracy,
                        )}
                      </td>

                      <td>
                        {formatPct(
                          item.f1_score,
                        )}
                      </td>

                      <td>
                        <span className="inline-flex rounded-full border theme-border px-3 py-1 text-xs font-medium theme-text">
                          {item.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

      <p className="mt-2 text-lg font-semibold theme-text">
        {value}
      </p>
    </div>
  );
}

export default TrainingDashboardPage;