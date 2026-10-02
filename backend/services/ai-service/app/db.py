from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.config import DATABASE_URL


def normalize_db_url(url: str) -> str:
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url


engine = create_engine(normalize_db_url(DATABASE_URL), future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    model_version: Mapped[str] = mapped_column(String(32), index=True)
    dataset_version: Mapped[str] = mapped_column(String(64))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    algoritmo: Mapped[str] = mapped_column(String(80))
    cantidad_registros: Mapped[int] = mapped_column(Integer)
    cantidad_features: Mapped[int] = mapped_column(Integer)
    parametros: Mapped[str] = mapped_column(Text)
    accuracy: Mapped[float] = mapped_column(Float)
    precision: Mapped[float] = mapped_column(Float)
    recall: Mapped[float] = mapped_column(Float)
    f1_score: Mapped[float] = mapped_column(Float)
    confusion_matrix: Mapped[str] = mapped_column(Text)
    feature_importances: Mapped[str] = mapped_column(Text)
    metricas: Mapped[str] = mapped_column(Text)
    model_path: Mapped[str] = mapped_column(String(512))
    estado: Mapped[str] = mapped_column(String(32), default="COMPLETADO")
    dataset_path: Mapped[str] = mapped_column(String(512), default="")
    nota: Mapped[str] = mapped_column(Text, default="")


def init_db() -> None:
    Base.metadata.create_all(engine)


def save_training_run(metadata: dict, session: Session | None = None) -> TrainingRun:
    owns = session is None
    session = session or SessionLocal()
    row = TrainingRun(
        id=metadata["training_id"],
        model_version=metadata["model_version"],
        dataset_version=metadata["dataset_version"],
        fecha=datetime.fromisoformat(metadata["fecha_entrenamiento"].replace("Z", "+00:00")),
        algoritmo=metadata["algoritmo"],
        cantidad_registros=metadata["cantidad_registros"],
        cantidad_features=metadata["cantidad_features"],
        parametros=__import__("json").dumps(metadata["parametros"]),
        accuracy=metadata["metricas"]["accuracy"],
        precision=metadata["metricas"]["precision"],
        recall=metadata["metricas"]["recall"],
        f1_score=metadata["metricas"]["f1_score"],
        confusion_matrix=__import__("json").dumps(metadata["metricas"]["confusion_matrix"]),
        feature_importances=__import__("json").dumps(metadata["feature_importances"]),
        metricas=__import__("json").dumps(metadata["metricas"]),
        model_path=metadata["model_path"],
        estado=metadata.get("estado", "COMPLETADO"),
        dataset_path=metadata.get("dataset_path", ""),
        nota=metadata.get("nota_academica", ""),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    if owns:
        session.close()
    return row


def serialize_run(row: TrainingRun) -> dict:
    import json

    return {
        "training_id": row.id,
        "model_version": row.model_version,
        "dataset_version": row.dataset_version,
        "fecha": row.fecha.isoformat() if row.fecha.tzinfo else row.fecha.replace(tzinfo=timezone.utc).isoformat(),
        "algoritmo": row.algoritmo,
        "cantidad_registros": row.cantidad_registros,
        "cantidad_features": row.cantidad_features,
        "parametros": json.loads(row.parametros),
        "accuracy": row.accuracy,
        "precision": row.precision,
        "recall": row.recall,
        "f1_score": row.f1_score,
        "confusion_matrix": json.loads(row.confusion_matrix),
        "feature_importances": json.loads(row.feature_importances),
        "metricas": json.loads(row.metricas),
        "model_path": row.model_path,
        "estado": row.estado,
        "dataset_path": row.dataset_path,
        "nota": row.nota,
    }
