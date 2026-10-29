from __future__ import annotations

import csv
import json
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from app.config import MODEL_FEATURE_COLUMNS
from app.features import extract_features


SEED = 20261021
NORMAL_PER_FAMILY = 70
ANOMALY_PER_FAMILY = 30
OUTPUT = Path("/app/data/synthetic/expansion_v3")

EVENT_SERVICES = {
    "LOGIN": "users-service",
    "LOGOUT": "users-service",
    "LOGIN_FALLIDO": "users-service",
    "USUARIO_CREADO": "users-service",
    "USUARIO_MODIFICADO": "users-service",
    "USUARIO_DESACTIVADO": "users-service",
    "CAMBIO_ROL": "users-service",
    "VENTA_CREADA": "sales-service",
    "VENTA_ANULADA": "sales-service",
    "STOCK_MODIFICADO": "inventory-service",
    "PRECIO_MODIFICADO": "products-service",
    "PRODUCTO_MODIFICADO": "products-service",
}


class CaseBuilder:
    def __init__(self, case_id: str, sequence: int, rng: random.Random):
        self.case_id = case_id
        self.sequence = sequence
        self.rng = rng
        self.actor = 1000 + sequence % 37
        self.base = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(
            days=sequence % 365
        )
        self.events = []

    def add(
        self,
        kind: str,
        minute: float,
        entity: str = "sesion",
        entity_id: str | int | None = 1,
        result: str = "EXITOSO",
        metadata: dict | None = None,
    ):
        timestamp = self.base + timedelta(seconds=minute * 60)
        event_number = len(self.events) + 1
        self.events.append({
            "event_id": f"{self.case_id}-E{event_number:03d}",
            "service": EVENT_SERVICES.get(kind, "users-service"),
            "usuario_id": self.actor,
            "tipo_evento": kind,
            "entidad": entity,
            "entidad_id": entity_id,
            "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
            "resultado": result,
            "ip": f"192.0.2.{1 + self.sequence % 250}",
            "metadata": {
                "caso_id": self.case_id,
                **(metadata or {}),
            },
        })

    def add_sale(self, minute: float, sale_id: str):
        """Registra una venta y su salida de inventario correlacionada."""
        self.add("VENTA_CREADA", minute, "venta", sale_id)
        self.add(
            "STOCK_MODIFICADO",
            minute + 0.01,
            "variante_producto",
            f"{sale_id}-V",
            metadata={
                "tipo_movimiento": "SALIDA",
                "referencia_tipo": "VENTA",
                "venta_id": sale_id,
            },
        )

    def make(self, family: str, anomalous: bool):
        r = self.rng
        add = self.add

        if family == "autenticacion":
            add("LOGIN", 0)
            failures = r.randint(5, 8) if anomalous else r.randint(0, 2)
            for i in range(failures):
                add(
                    "LOGIN_FALLIDO", 1 + i * 0.8,
                    result="FALLIDO",
                )
            add("LOGIN", 9)

        elif family == "anulaciones":
            count = r.randint(3, 5) if anomalous else r.randint(0, 1)
            sales = max(count, r.randint(1, 2)) if not anomalous else count
            for i in range(sales):
                sale_id = f"{self.case_id}-S{i + 1}"
                minute = 2 + i * 4
                self.add_sale(minute, sale_id)
                if i < count:
                    add("VENTA_ANULADA", minute + 0.8, "venta", sale_id)

        elif family == "administracion":
            count = r.randint(3, 6) if anomalous else r.randint(0, 2)
            actions = [
                "USUARIO_MODIFICADO",
                "CAMBIO_ROL",
                "USUARIO_DESACTIVADO",
                "USUARIO_CREADO",
            ]
            for i in range(count):
                add(
                    actions[i % len(actions)],
                    1 + i * (0.8 if anomalous else 5),
                    "usuario",
                    f"{self.case_id}-U{i + 1}",
                )
            add("LOGOUT", 9)

        elif family == "precio_venta":
            add("PRECIO_MODIFICADO", 0, "producto", f"{self.case_id}-P1")
            count = r.randint(1, 3)
            gap = r.uniform(2, 8) if anomalous else r.uniform(18, 25)
            for i in range(count):
                self.add_sale(
                    gap + i * 1.5,
                    f"{self.case_id}-S{i + 1}",
                )

        elif family == "velocidad_ventas":
            count = r.randint(8, 14) if anomalous else r.randint(1, 4)
            for i in range(count):
                minute = (
                    1 + i * r.uniform(0.15, 0.35)
                    if anomalous
                    else 2 + i * 6
                )
                self.add_sale(minute, f"{self.case_id}-S{i + 1}")

        elif family == "alcance_administrativo":
            count = r.randint(4, 7) if anomalous else r.randint(1, 2)
            for i in range(count):
                if anomalous:
                    minute = 1 + i * r.uniform(0.15, 0.8)
                else:
                    minute = 2 + i * r.uniform(3.0, 6.0)

                add(
                    "USUARIO_MODIFICADO",
                    minute,
                    "usuario",
                    f"{self.case_id}-U{i + 1}",
                )

        elif family == "consistencia_inventario":
            count = r.randint(2, 4) if anomalous else r.randint(1, 3)

            for i in range(count):
                sale_id = f"{self.case_id}-S{i + 1}"

                if anomalous:
                    sale_minute = 1 + i * r.uniform(0.6, 1.2)
                else:
                    sale_minute = 3 + i * r.uniform(3.0, 5.0)

                add("VENTA_CREADA", sale_minute, "venta", sale_id)

                # Los casos normales mantienen todas las salidas vinculadas.
                # Los anomalos incluyen una venta sin salida asociada y pueden
                # incluir otras ventas correctamente vinculadas.
                has_stock_link = (
                    not anomalous
                    or i == 0
                    or (i >= 2 and r.random() < 0.5)
                )

                if has_stock_link:
                    add(
                        "STOCK_MODIFICADO",
                        sale_minute + 0.01,
                        "variante_producto",
                        f"{self.case_id}-V{i + 1}",
                        metadata={
                            "tipo_movimiento": "SALIDA",
                            "referencia_tipo": "VENTA",
                            "venta_id": sale_id,
                        },
                    )

        elif family == "patron_combinado":
            failures = r.randint(5, 6) if anomalous else r.randint(0, 1)
            cancellations = r.randint(3, 4) if anomalous else r.randint(0, 1)
            admin_actions = r.randint(3, 4) if anomalous else r.randint(0, 1)

            # La autenticacion ocurre cerca del final de la secuencia.
            # Esto permite evaluar la ventana temporal de 10 minutos.
            for i in range(failures):
                add(
                    "LOGIN_FALLIDO", 17 + i * 0.5,
                    result="FALLIDO",
                )
            add("LOGIN", 20.5)

            for i in range(cancellations):
                sale_id = f"{self.case_id}-S{i + 1}"
                minute = 5 + i * 1.2
                self.add_sale(minute, sale_id)
                add("VENTA_ANULADA", minute + 0.3, "venta", sale_id)

            for i in range(admin_actions):
                add(
                    "USUARIO_MODIFICADO",
                    17 + i * 0.6,
                    "usuario",
                    f"{self.case_id}-U{i + 1}",
                )

            # Venta adicional para evaluar la consistencia del inventario.
            # Los casos normales incluyen su salida; los anomalos no.
            inventory_sale_id = f"{self.case_id}-INV-S1"
            add(
                "VENTA_CREADA",
                10,
                "venta",
                inventory_sale_id,
            )

            if not anomalous:
                add(
                    "STOCK_MODIFICADO",
                    10.01,
                    "variante_producto",
                    f"{self.case_id}-INV-V1",
                    metadata={
                        "tipo_movimiento": "SALIDA",
                        "referencia_tipo": "VENTA",
                        "venta_id": inventory_sale_id,
                    },
                )

        return self.events



def add_context_variation(builder: CaseBuilder):
    """AÃ±ade actividad contextual legÃ­tima para ampliar la variabilidad."""
    if not builder.events:
        return

    last_ts = max(
        datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
        for e in builder.events
    )
    last_minute = (last_ts - builder.base).total_seconds() / 60.0

    for i in range(builder.rng.randint(0, 2)):
        minute = last_minute - builder.rng.uniform(0.2, 8.0)
        builder.add(
            "LOGIN", minute, "sesion",
            f"{builder.case_id}-CTX-L{i + 1}",
        )

    for i in range(builder.rng.randint(0, 3)):
        minute = last_minute - builder.rng.uniform(0.2, 8.0)
        builder.add(
            "STOCK_MODIFICADO", minute, "variante_producto",
            f"{builder.case_id}-CTX-STOCK-{i + 1}",
            metadata={"tipo_movimiento": "AJUSTE"},
        )

    builder.events.sort(key=lambda e: e["timestamp"])
def synthetic_label(features: dict) -> int:
    """Etiqueta experimental derivada de reglas observables, no de fraude real."""
    signals = (
        features["failed_login_count"] >= 5,
        features["cancelled_sales_count"] >= 3,
        features["admin_action_count"] >= 3,
        features["user_change_count"] >= 4,
        features["sales_after_price_change"] >= 1,
        features["sales_count_5m"] >= 6,
        features["sales_without_stock_link_count"] >= 1,
    )
    return int(any(signals))

def main():
    if OUTPUT.exists():
        raise SystemExit(
            f"Se cancela para proteger archivos existentes: {OUTPUT}"
        )

    rng = random.Random(SEED)
    families = [
        "autenticacion",
        "anulaciones",
        "administracion",
        "precio_venta",
        "velocidad_ventas",
        "alcance_administrativo",
        "consistencia_inventario",
        "patron_combinado",
    ]

    feature_rows = []
    case_rows = []
    all_events = []
    sequence = 0

    for family in families:
        for anomalous, cases_count in (
            (False, NORMAL_PER_FAMILY),
            (True, ANOMALY_PER_FAMILY),
        ):
            for _ in range(cases_count):
                sequence += 1
                case_id = f"V3-{sequence:04d}"
                builder = CaseBuilder(case_id, sequence, rng)
                events = builder.make(family, anomalous)

                # La referencia temporal permite evaluar ventas sin movimiento
                # cuando ya transcurriÃ³ la ventana de correlaciÃ³n de 15 minutos.
                if family in ("consistencia_inventario", "patron_combinado"):
                    builder.add("LOGOUT", 25)

                add_context_variation(builder)
                events = builder.events

                # Se usa la extracciÃ³n real del servicio, no variables
                # calculadas manualmente para favorecer una clase.
                features = extract_features(events)

                # La etiqueta procede del escenario experimental previsto.
                label = int(anomalous)
                observed_label = synthetic_label(features)

                # Validar coherencia sin derivar la etiqueta de las features.
                if observed_label != label:
                    raise ValueError(
                        f"{case_id}: las caracteristicas extraidas no respaldan "
                        "la etiqueta prevista. Se cancela la generacion."
                    )
                missing = [
                    name for name in MODEL_FEATURE_COLUMNS
                    if name not in features
                ]
                if missing:
                    raise ValueError(
                        f"{case_id}: faltan variables: {missing}"
                    )

                row = {
                    name: features[name]
                    for name in MODEL_FEATURE_COLUMNS
                }
                row.update({
                    "label": label,
                    "scenario": family,
                    "case_id": case_id,
                    "label_source": (
                        "anomalia_simulada" if label
                        else "normal_sintetico"
                    ),
                })
                feature_rows.append(row)

                case_rows.append({
                    "case_id": case_id,
                    "scenario": family,
                    "label": label,
                    "label_text": (
                        "anomalia_simulada" if label else "normal"
                    ),
                    "n_events": len(events),
                    "seed": SEED,
                })
                all_events.extend(events)

    frame = pd.DataFrame(feature_rows)

    required = list(MODEL_FEATURE_COLUMNS) + ["label", "scenario"]
    if frame[required].isna().any().any():
        raise ValueError("El dataset contiene valores nulos en campos requeridos.")
    if not set(frame["label"].unique()).issubset({0, 1}):
        raise ValueError("Etiquetas inesperadas.")
    if frame["case_id"].duplicated().any():
        raise ValueError("Hay identificadores de caso duplicados.")
    if frame.duplicated(subset=list(MODEL_FEATURE_COLUMNS)).sum() > len(frame) * 0.95:
        raise ValueError(
            "MÃ¡s del 95% de las filas repiten el vector de caracterÃ­sticas; "
            "se cancela la publicaciÃ³n del conjunto experimental."
        )

    # Un mismo vector observable no puede representar ambas clases.
    vector_labels = frame.groupby(
        list(MODEL_FEATURE_COLUMNS), dropna=False
    )["label"].nunique()

    contradictory_vectors = int((vector_labels > 1).sum())
    if contradictory_vectors:
        raise ValueError(
            f"Se encontraron {contradictory_vectors} vectores de caracterÃ­sticas "
            "con etiquetas contradictorias. Se cancela la generaciÃ³n."
        )

    class_by_family = (
        frame.groupby("scenario")["label"].nunique().to_dict()
    )
    if any(number != 2 for number in class_by_family.values()):
        raise ValueError("Cada familia debe contener ambas clases.")

    OUTPUT.mkdir(parents=True)

    frame.to_csv(OUTPUT / "training_v3.csv", index=False)
    pd.DataFrame(case_rows).to_csv(OUTPUT / "cases_v3.csv", index=False)

    with (OUTPUT / "events_v3.jsonl").open("w", encoding="utf-8") as stream:
        for event in all_events:
            stream.write(json.dumps(event, ensure_ascii=False) + "\n")

    class_counts = Counter(frame["label"])
    scenario_counts = defaultdict(Counter)
    for row in feature_rows:
        scenario_counts[row["scenario"]][str(row["label"])] += 1

    manifest = {
        "version": "expansion_v3",
        "provenance": "Datos sintÃ©ticos generados para experimentaciÃ³n; "
                      "no son registros histÃ³ricos de Boutique SposaBella.",
        "seed": SEED,
        "n_cases": len(frame),
        "n_events": len(all_events),
        "n_feature_columns": len(MODEL_FEATURE_COLUMNS),
        "feature_columns": list(MODEL_FEATURE_COLUMNS),
        "class_counts": {
            "normal_sintetico": class_counts.get(0, 0),
            "anomalia_simulada": class_counts.get(1, 0),
        },
        "scenario_counts": {
            family: dict(counts)
            for family, counts in scenario_counts.items()
        },
        "grouping": "scenario identifica una familia operativa compartida "
                    "por ambas clases; debe dividirse por grupos.",
        "label_rule": [
            "failed_login_count >= 5",
            "cancelled_sales_count >= 3",
            "admin_action_count >= 3",
            "user_change_count >= 4",
            "sales_after_price_change >= 1",
            "sales_count_5m >= 6",
            "sales_without_stock_link_count >= 1"
        ],
        "label_limit": "Las etiquetas representan intervenciones sintÃ©ticas "
                       "predefinidas, no fraude confirmado.",
        "validation": {
            "unique_case_ids": bool(frame["case_id"].is_unique),
            "no_required_nulls": bool(not frame[required].isna().any().any()),
            "both_classes_per_family": bool(
                all(value == 2 for value in class_by_family.values())
            ),
            "feature_vector_duplicates": int(
                frame.duplicated(subset=list(MODEL_FEATURE_COLUMNS)).sum()
            ),
        },
    }

    (OUTPUT / "manifest_v3.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\nArchivos creados en: {OUTPUT}")


if __name__ == "__main__":
    main()
