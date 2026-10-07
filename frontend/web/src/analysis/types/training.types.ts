export interface TrainingSummary {
  training_id: string;
  model_version: string;
  dataset_version: string;
  fecha: string;
  algoritmo: string;
  cantidad_registros: number;
  cantidad_features: number;
  parametros: Record<string, unknown>;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  confusion_matrix: number[][];
  feature_importances: Record<string, number>;
  metricas: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    precision_por_clase?: Record<string, number>;
    recall_por_clase?: Record<string, number>;
    f1_por_clase?: Record<string, number>;
    confusion_matrix: number[][];
  };
  model_path: string;
  estado: string;
  dataset_path?: string;
  nota?: string;
}

export interface ModelMetadata {
  training_id: string;
  model_version: string;
  dataset_version: string;
  fecha_entrenamiento: string;
  algoritmo: string;
  parametros: Record<string, unknown>;
  features: string[];
  cantidad_registros: number;
  cantidad_features: number;
  metricas: TrainingSummary["metricas"];
  feature_importances: Record<string, number>;
  model_path: string;
  estado: string;
}

export interface MetricsPayload {
  actual?: TrainingSummary["metricas"] | null;
  historial?: Array<{
    training_id: string;
    model_version: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  }>;
  entrenamientos?: unknown[];
  mensaje?: string;
}
