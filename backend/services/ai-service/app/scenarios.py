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
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=4), "venta", 100, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=9), "venta", 101, metadata={"quantity_ref": max(1, quantity_ref - 1)}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=12 + int(rng.integers(0, 8)))),
    ]


def scenario_normal_b(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=3), "venta", 110, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=8), "venta", 111, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=14), "venta", 112, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=20)),
    ]


def scenario_normal_c(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(
            usuario_id,
            "PRECIO_MODIFICADO",
            t + timedelta(minutes=5),
            "variante_producto",
            50,
            metadata={"precio_anterior": 10, "precio_nuevo": 12},
        ),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=12), "venta", 120, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=18)),
    ]


def scenario_normal_busy(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    for index in range(12):
        events.append(
            make_event(
                usuario_id,
                "VENTA_CREADA",
                t + timedelta(seconds=5 * (index + 1)),
                "venta",
                130 + index,
                metadata={"quantity_ref": quantity_ref},
            )
        )
    events.append(make_event(usuario_id, "LOGOUT", t + timedelta(minutes=2)))
    return events


def scenario_failed_logins(usuario_id: int, rng, _quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=1 + 2 * i), resultado="FALLIDO")
        for i in range(5 + int(rng.integers(0, 2)))
    ]
    events.append(make_event(usuario_id, "LOGIN", t + timedelta(minutes=11)))
    return events


def scenario_cancellations(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    for i in range(3):
        events.append(
            make_event(
                usuario_id,
                "VENTA_CREADA",
                t + timedelta(minutes=2 + i * 4),
                "venta",
                200 + i,
                metadata={"quantity_ref": quantity_ref},
            )
        )
        events.append(
            make_event(
                usuario_id,
                "VENTA_ANULADA",
                t + timedelta(minutes=3 + i * 4),
                "venta",
                200 + i,
            )
        )
    events.append(make_event(usuario_id, "LOGOUT", t + timedelta(minutes=20)))
    return events


def scenario_stock_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=4), "venta", 300, metadata={"quantity_ref": quantity_ref}),
        make_event(
            usuario_id,
            "STOCK_MODIFICADO",
            t + timedelta(minutes=4, milliseconds=270),
            "variante_producto",
            9,
            metadata={
                "tipo_movimiento": "SALIDA",
                "referencia_tipo": "VENTA",
                "venta_id": "300",
            },
        ),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=8)),
    ]


def scenario_price_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "PRECIO_MODIFICADO", t + timedelta(minutes=1), "producto", 11),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=3), "venta", 310, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=5), "venta", 311, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=9)),
    ]


def scenario_admin_burst(usuario_id: int, rng, _quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "USUARIO_MODIFICADO", t + timedelta(minutes=1), "usuario", 80),
        make_event(usuario_id, "USUARIO_MODIFICADO", t + timedelta(minutes=2), "usuario", 81),
        make_event(usuario_id, "CAMBIO_ROL", t + timedelta(minutes=3), "usuario", 80),
        make_event(usuario_id, "USUARIO_DESACTIVADO", t + timedelta(minutes=4), "usuario", 81),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=6)),
    ]


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


def scenario_combined(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [
        make_event(
            usuario_id,
            "LOGIN_FALLIDO",
            t + timedelta(minutes=1.2 * index),
            resultado="FALLIDO",
        )
        for index in range(5)
    ]
    events.append(make_event(usuario_id, "LOGIN", t + timedelta(minutes=5.5)))
    for index in range(3):
        sale_id = 500 + index
        sale_time = t + timedelta(minutes=6 + index)
        events.append(
            make_event(
                usuario_id,
                "VENTA_CREADA",
                sale_time,
                "venta",
                sale_id,
                metadata={"quantity_ref": quantity_ref},
            )
        )
        events.append(
            make_event(
                usuario_id,
                "VENTA_ANULADA",
                sale_time + timedelta(seconds=30),
                "venta",
                sale_id,
            )
        )
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
