from app.train_model import train_decision_tree
from app.db import init_db, save_training_run


def main() -> None:
    init_db()
    metadata = train_decision_tree()
    save_training_run(metadata)
    metrics = metadata["metricas"]
    print(f"Modelo {metadata['model_version']} guardado en {metadata['model_path']}")
    print(f"accuracy={metrics['accuracy']:.4f} precision={metrics['precision']:.4f} recall={metrics['recall']:.4f} f1={metrics['f1_score']:.4f}")
    print("confusion_matrix=", metrics["confusion_matrix"])


if __name__ == "__main__":
    main()
