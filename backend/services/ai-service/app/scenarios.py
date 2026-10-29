from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4


def make_event(
    usuario_id: int,
    tipo_evento: str,
    timestamp: datetime,
    entidad: str = "sesion",
    entidad_id: int | None = 1,
    resultado: str = "EXITOSO",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    service = {
        "LOGIN": "users-service",
        "LOGOUT": "users-service",
        "LOGIN_FALLIDO": "users-service",
        "USUARIO_CREADO": "users-service",
        "USUARIO_MODIFICADO": "users-service",
        "USUARIO_DESACTIVADO": "users-service",
        "CAMBIO_ROL": "users-service",
        "VENTA_CREADA": "sales-service",
        "VENTA_ANULADA": "sales-service",
        "PAGO_REGISTRADO": "sales-service",
        "STOCK_MODIFICADO": "inventory-service",
        "PRECIO_MODIFICADO": "products-service",
        "PRODUCTO_CREADO": "products-service",
        "PRODUCTO_MODIFICADO": "products-service",
    }.get(tipo_evento, "users-service")
    return {
        "event_id": str(uuid4()),
        "service": service,
        "usuario_id": usuario_id,
        "tipo_evento": tipo_evento,
        "entidad": entidad,
        "entidad_id": entidad_id,
        "timestamp": timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "resultado": resultado,
        "ip": f"192.168.1.{(usuario_id % 200) + 10}",
        "metadata": metadata or {},
    }


def _base(usuario_id: int, offset_minutes: int = 0) -> datetime:
    return datetime(2026, 3, 15, 14, 0, tzinfo=timezone.utc) + timedelta(
        minutes=offset_minutes,
        days=usuario_id % 20,
    )


def scenario_normal_a(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    count = int(rng.integers(1, 5))
    minute = int(rng.integers(1, 6))
    for i in range(count):
        events.append(make_event(
            usuario_id, "VENTA_CREADA", t + timedelta(minutes=minute),
            "venta", 1000 + i,
            metadata={"quantity_ref": quantity_ref}
        ))
        minute += int(rng.integers(2, 7))
    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=minute + int(rng.integers(1, 6)))
    ))
    return events



def scenario_normal_b(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    count = int(rng.integers(2, 5))
    events = [make_event(usuario_id, "LOGIN", t)]
    minute = 3
    for i in range(count):
        sale_id = 110 + i
        events.append(make_event(
            usuario_id, "VENTA_CREADA", t + timedelta(minutes=minute),
            "venta", sale_id, metadata={"quantity_ref": quantity_ref}
        ))
        minute += int(rng.integers(5, 8))
    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=max(22, minute + 1))
    ))
    return events



def scenario_normal_c(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    price_minute = int(rng.integers(3, 13))
    events.append(make_event(
        usuario_id, "PRECIO_MODIFICADO",
        t + timedelta(minutes=price_minute), "producto",
        int(rng.integers(700, 900))
    ))
    count = int(rng.integers(0, 5))
    minute = price_minute + int(rng.integers(1, 5))
    for i in range(count):
        events.append(make_event(
            usuario_id, "VENTA_CREADA",
            t + timedelta(minutes=minute),
            "venta", 2000 + i,
            metadata={"quantity_ref": quantity_ref}
        ))
        minute += int(rng.integers(1, 6))
    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=max(22, minute + 1))
    ))
    return events




def scenario_normal_busy(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    count = int(rng.integers(6, 11))
    events = [make_event(usuario_id, "LOGIN", t)]
    for i in range(count):
        minute = 0.05 + i * 0.03
        events.append(make_event(
            usuario_id, "VENTA_CREADA",
            t + timedelta(minutes=minute),
            "venta", 300 + i,
            metadata={"quantity_ref": quantity_ref}
        ))
    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=0.05 + count * 0.03 + 0.05)
    ))
    return events




def scenario_failed_logins(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    count = int(rng.integers(5, 11))
    events = []
    minute = float(rng.uniform(0.2, 1.2))
    for i in range(count):
        events.append(make_event(
            usuario_id, "LOGIN_FALLIDO",
            t + timedelta(minutes=minute),
            resultado="FALLIDO"
        ))
        minute += float(rng.uniform(0.25, 1.8))
    events.append(make_event(
        usuario_id, "LOGIN",
        t + timedelta(minutes=minute + float(rng.uniform(0.5, 4.0)))
    ))
    return events




def scenario_cancellations(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    cancelled_count = int(rng.integers(3, 8))
    extra_sales = int(rng.integers(0, 4))
    minute = int(rng.integers(1, 4))
    sale_index = 0

    for i in range(cancelled_count):
        sale_id = 30000 + usuario_id * 10 + sale_index
        sale_index += 1
        sale_time = t + timedelta(minutes=minute)
        events.append(make_event(
            usuario_id, "VENTA_CREADA", sale_time,
            "venta", sale_id,
            metadata={"quantity_ref": quantity_ref}
        ))
        cancel_delay = float(rng.uniform(0.3, 2.0))
        events.append(make_event(
            usuario_id, "VENTA_ANULADA",
            sale_time + timedelta(minutes=cancel_delay),
            "venta", sale_id
        ))
        minute += int(rng.integers(2, 6))

    for _ in range(extra_sales):
        sale_id = 30000 + usuario_id * 10 + sale_index
        sale_index += 1
        minute += int(rng.integers(1, 4))
        events.append(make_event(
            usuario_id, "VENTA_CREADA",
            t + timedelta(minutes=minute),
            "venta", sale_id,
            metadata={"quantity_ref": quantity_ref}
        ))

    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=max(24, minute + 2))
    ))
    return events




def scenario_stock_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    count = int(rng.integers(1, 7))
    minute = int(rng.integers(1, 6))
    for i in range(count):
        sale_id = 10000 + usuario_id * 10 + i
        sale_time = t + timedelta(minutes=minute)
        events.append(make_event(
            usuario_id, "VENTA_CREADA", sale_time,
            "venta", sale_id,
            metadata={"quantity_ref": quantity_ref}
        ))
        events.append(make_event(
            usuario_id, "STOCK_MODIFICADO",
            sale_time + timedelta(milliseconds=270),
            "variante_producto", int(rng.integers(1, 100)),
            metadata={
                "tipo_movimiento": "SALIDA",
                "referencia_tipo": "VENTA",
                "venta_id": str(sale_id),
            }
        ))
        minute += int(rng.integers(1, 6))
    events.append(make_event(
        usuario_id, "LOGOUT",
        t + timedelta(minutes=minute + int(rng.integers(1, 5)))
    ))
    return events



def scenario_price_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "PRECIO_MODIFICADO", t + timedelta(minutes=1), "producto", 11),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=3), "venta", 310, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=5), "venta", 311, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=9)),
    ]


def scenario_admin_burst(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    count = int(rng.integers(4, 7))
    kinds = ["USUARIO_MODIFICADO", "CAMBIO_ROL", "USUARIO_DESACTIVADO"]
    for i in range(count):
        minute = 1 + i * 0.8
        kind = kinds[i % len(kinds)]
        entity_id = 80 + int(rng.integers(0, 12))
        events.append(make_event(
            usuario_id, kind, t + timedelta(minutes=minute),
            "usuario", entity_id
        ))
    events.append(make_event(usuario_id, "LOGOUT", t + timedelta(minutes=8)))
    return events



def scenario_burst(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    for i in range(19):
        tipo = "VENTA_CREADA" if i % 3 else "PRODUCTO_MODIFICADO"
        entidad = "venta" if tipo == "VENTA_CREADA" else "producto"
        events.append(
            make_event(
                usuario_id,
                tipo,
                t + timedelta(seconds=5 * (i + 1)),
                entidad,
                400 + i,
                metadata={"quantity_ref": quantity_ref} if tipo == "VENTA_CREADA" else {},
            )
        )
    return events


def scenario_combined(usuario_id, rng, quantity_ref):
    t = _base(usuario_id)
    events = []
    failed = int(rng.integers(5, 8))
    for i in range(failed):
        events.append(make_event(
            usuario_id, "LOGIN_FALLIDO",
            t + timedelta(minutes=0.8 * (i + 1)), resultado="FALLIDO"
        ))
    events.append(make_event(usuario_id, "LOGIN", t + timedelta(minutes=7)))
    count = int(rng.integers(3, 5))
    for i in range(count):
        sale_id = 500 + i
        minute = 8 + i * 2
        events.append(make_event(
            usuario_id, "VENTA_CREADA", t + timedelta(minutes=minute),
            "venta", sale_id, metadata={"quantity_ref": quantity_ref}
        ))
        events.append(make_event(
            usuario_id, "VENTA_ANULADA",
            t + timedelta(minutes=minute, seconds=30), "venta", sale_id
        ))
    return events



NORMAL_SCENARIOS = {
    "normal_a": scenario_normal_a,
    "normal_b": scenario_normal_b,
    "normal_c": scenario_normal_c,
    "normal_busy": scenario_normal_busy,
    "normal_sale_inventory_link": scenario_stock_then_sale,
}

ANOMALY_SCENARIOS = {
    "failed_logins": scenario_failed_logins,
    "cancellations": scenario_cancellations,
    "admin_burst": scenario_admin_burst,
    "combined": scenario_combined,
}
