from __future__ import annotations

import csv
import json
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = BASE / "data" / "synthetic" / "expansion_v1"
SEED = 20261020
RNG = random.Random(SEED)

COLUMNS = [
    "ID_Registro", "Tipo_Registro", "Nro_Referencia",
    "Fecha_Transaccion", "Cliente", "Telefono", "Concepto",
    "Monto_Bs", "Garantia_Adelanto", "Fecha_Entrega",
    "Devolucion_Prenda", "Estado",
]

CONCEPTS = [
    "Confeccion de vestido",
    "Arreglo de prenda",
    "Venta de accesorio",
    "Alquiler de vestido",
    "Confeccion de blusa",
    "Arreglo de vestido",
]

EVENT_SERVICES = {
    "LOGIN": "users-service",
    "LOGOUT": "users-service",
    "LOGIN_FALLIDO": "users-service",
    "USUARIO_MODIFICADO": "users-service",
    "USUARIO_DESACTIVADO": "users-service",
    "CAMBIO_ROL": "users-service",
    "VENTA_CREADA": "sales-service",
    "VENTA_ANULADA": "sales-service",
    "PAGO_REGISTRADO": "sales-service",
    "STOCK_MODIFICADO": "inventory-service",
}

event_counter = 0


def make_event(user_id, event_type, when, case_id, entity="sesion",
               entity_id=None, result="EXITOSO", metadata=None):
    global event_counter
    event_counter += 1
    data = dict(metadata or {})
    data["caso_id"] = case_id

    return {
        "event_id": f"EVT-{event_counter:06d}",
        "service": EVENT_SERVICES.get(event_type, "users-service"),
        "usuario_id": user_id,
        "tipo_evento": event_type,
        "entidad": entity,
        "entidad_id": entity_id,
        "timestamp": when.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "resultado": result,
        "ip": f"192.0.2.{(user_id % 200) + 1}",
        "metadata": data,
    }


def make_commercial_rows(year):
    statuses = ["Completado"] * 330 + ["Cancelado"] * 20 + ["Pendiente"] * 150
    RNG.shuffle(statuses)
    rows = []
    first_day = datetime(year, 1, 1)
    days_in_year = 366 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 365

    for i, status in enumerate(statuses, start=1):
        transaction_day = first_day + timedelta(days=RNG.randrange(days_in_year))
        amount = round(RNG.uniform(80, 4500), 2)
        is_order = status != "Pendiente"
        delivery_day = (
            transaction_day + timedelta(days=RNG.randint(2, 25))
            if status == "Completado"
            else None
        )
        concept = RNG.choice(CONCEPTS)
        deposit = (
            f"{round(amount * RNG.uniform(0.30, 0.70), 2):.2f}"
            if is_order else ""
        )
        returned = (
            RNG.choice(["Si", "No"])
            if status == "Completado" and "Alquiler" in concept
            else ""
        )

        rows.append({
            "ID_Registro": f"REG{str(year)[-2:]}-{i:04d}",
            "Tipo_Registro": "Cuaderno" if is_order else "Recibo",
            "Nro_Referencia": f"REF{str(year)[-2:]}-{i:04d}",
            "Fecha_Transaccion": transaction_day.strftime("%Y-%m-%d"),
            "Cliente": f"CLIENTE_{((i - 1) % 250) + 1:04d}",
            "Telefono": "",
            "Concepto": concept,
            "Monto_Bs": f"{amount:.2f}",
            "Garantia_Adelanto": deposit,
            "Fecha_Entrega": delivery_day.strftime("%Y-%m-%d") if delivery_day else "",
            "Devolucion_Prenda": returned,
            "Estado": status,
        })

    return rows


def create_case_events(year, row, case_number, scenario, label):
    case_id = f"CASO{str(year)[-2:]}-{case_number:03d}"
    record_id = row["ID_Registro"]
    user_id = 1000 + ((case_number - 1) % 10) + 1
    day = datetime.strptime(row["Fecha_Transaccion"], "%Y-%m-%d")
    base = day.replace(hour=14, minute=0, second=0, tzinfo=timezone.utc)
    events = []

    def add(offset, kind, entity="sesion", entity_id=None,
            result="EXITOSO", metadata=None):
        events.append(make_event(
            user_id, kind, base + timedelta(seconds=offset), case_id,
            entity, entity_id, result, metadata
        ))

    if scenario == "normal_venta":
        add(0, "LOGIN")
        add(180, "VENTA_CREADA", "venta", record_id,
            metadata={"referencia": row["Nro_Referencia"]})
        add(300, "PAGO_REGISTRADO", "pago", f"PAGO-{record_id}")
        add(600, "LOGOUT")

    elif scenario == "normal_venta_inventario":
        add(0, "LOGIN")
        add(180, "VENTA_CREADA", "venta", record_id,
            metadata={"referencia": row["Nro_Referencia"]})
        add(185, "STOCK_MODIFICADO", "variante_producto",
            f"VAR-{case_number:03d}",
            metadata={
                "tipo_movimiento": "SALIDA",
                "referencia_tipo": "VENTA",
                "venta_id": record_id,
            })
        add(480, "LOGOUT")

    elif scenario == "intentos_fallidos":
        for n in range(5 + (case_number % 2)):
            add(60 + n * 90, "LOGIN_FALLIDO",
                result="FALLIDO")
        add(700, "LOGIN")

    elif scenario == "anulaciones":
        for n in range(3):
            sale_id = record_id if n == 0 else f"{record_id}-A{n}"
            add(60 + n * 180, "VENTA_CREADA", "venta", sale_id)
            add(100 + n * 180, "VENTA_ANULADA", "venta", sale_id)

    elif scenario == "actividad_administrativa":
        add(0, "LOGIN")
        add(60, "USUARIO_MODIFICADO", "usuario", f"USR-{case_number:03d}")
        add(120, "CAMBIO_ROL", "usuario", f"USR-{case_number:03d}")
        add(180, "USUARIO_DESACTIVADO", "usuario", f"USR-{case_number + 1:03d}")
        add(360, "LOGOUT")

    elif scenario == "patron_combinado":
        for n in range(5):
            add(45 + n * 55, "LOGIN_FALLIDO", result="FALLIDO")
        add(340, "LOGIN")
        for n in range(3):
            sale_id = record_id if n == 0 else f"{record_id}-C{n}"
            add(390 + n * 60, "VENTA_CREADA", "venta", sale_id)
            add(420 + n * 60, "VENTA_ANULADA", "venta", sale_id)

    return case_id, events


def write_csv(path, rows, columns):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main():
    if OUT.exists():
        raise SystemExit(
            f"El destino ya existe: {OUT}. No se sobrescribira ningun archivo."
        )

    # Preparar todo en memoria y validar antes de crear el destino.
    commercial = {}
    for year in (2024, 2025):
        rows = make_commercial_rows(year)
        assert len(rows) == 500
        assert len({r["ID_Registro"] for r in rows}) == 500
        assert all(r["Fecha_Transaccion"].startswith(str(year)) for r in rows)
        commercial[year] = rows

    all_events = []
    cases = []
    scenarios = (
        ["normal_venta"] * 20
        + ["normal_venta_inventario"] * 20
        + ["intentos_fallidos"] * 10
        + ["anulaciones"] * 10
        + ["actividad_administrativa"] * 10
        + ["patron_combinado"] * 10
    )

    for year, rows in commercial.items():
        selected_scenarios = scenarios.copy()
        RNG.shuffle(selected_scenarios)

        for case_number, scenario in enumerate(selected_scenarios, start=1):
            row = rows[case_number - 1]
            label = (
                "normal"
                if scenario.startswith("normal_")
                else "anomalia_simulada"
            )
            case_id, events = create_case_events(
                year, row, case_number, scenario, label
            )
            all_events.extend(events)
            cases.append({
                "ID_Caso": case_id,
                "Anio": year,
                "ID_Registro": row["ID_Registro"],
                "Etiqueta_Referencia": label,
                "Escenario": scenario,
                "Cantidad_Eventos": len(events),
            })

    OUT.mkdir(parents=True, exist_ok=False)

    for year, rows in commercial.items():
        write_csv(OUT / f"ventas_{year}.csv", rows, COLUMNS)

    with (OUT / "eventos.jsonl").open("w", encoding="utf-8") as handle:
        for event in sorted(all_events, key=lambda e: (e["timestamp"], e["event_id"])):
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")

    write_csv(
        OUT / "casos_evaluacion.csv",
        cases,
        ["ID_Caso", "Anio", "ID_Registro", "Etiqueta_Referencia",
         "Escenario", "Cantidad_Eventos"],
    )

    status_counts = {
        str(year): dict(Counter(row["Estado"] for row in rows))
        for year, rows in commercial.items()
    }
    manifest = {
        "version": "expansion_v1",
        "fecha_generacion_utc": datetime.now(timezone.utc).isoformat(),
        "semilla_reproducible": SEED,
        "proposito": "Pruebas controladas de integracion y evaluacion experimental",
        "procedencia": (
            "Registros generados mediante reglas programadas. No son ventas "
            "historicas verificadas ni eventos extraidos de operaciones reales."
        ),
        "archivos": {
            "ventas_2024.csv": {"filas": 500, "columnas": COLUMNS},
            "ventas_2025.csv": {"filas": 500, "columnas": COLUMNS},
            "eventos.jsonl": {"eventos": len(all_events)},
            "casos_evaluacion.csv": {
                "casos": len(cases),
                "etiquetas": "Etiquetas de referencia definidas por escenario, no por auditoria real"
            },
        },
        "conteo_estados": status_counts,
        "restricciones": [
            "No se incorporan nombres ni telefonos reales.",
            "Las direcciones IP pertenecen al rango reservado para documentacion.",
            "Las etiquetas representan escenarios programados, no fraude confirmado.",
            "No se generan caracteristicas de entrenamiento ni se entrena ningun modelo.",
            "La regla de enlace venta-inventario no implica por si sola una anomalia.",
            "Los datos deben describirse como datos de prueba en la metodologia."
        ],
    }
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Verificacion final de cantidades y correspondencia basica.
    for year in (2024, 2025):
        with (OUT / f"ventas_{year}.csv").open(
            newline="", encoding="utf-8-sig"
        ) as handle:
            assert sum(1 for _ in csv.DictReader(handle)) == 500

    assert len(cases) == 160
    assert len({case["ID_Caso"] for case in cases}) == 160

    print("Generacion completada.")
    print(f"Destino: {OUT}")
    print("Registros comerciales: 500 para 2024 y 500 para 2025")
    print(f"Casos de evaluacion: {len(cases)}")
    print(f"Eventos generados: {len(all_events)}")
    print("No se modificaron datasets existentes ni se entreno un modelo.")


if __name__ == "__main__":
    main()
