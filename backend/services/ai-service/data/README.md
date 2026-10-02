# Datos del componente de IA (SposaBella)

Este directorio **no** debe tratarse como un volcado de fraude de la boutique.

## Fuentes

### 1. Datos públicos (referencia transaccional)

- Conjunto: **Online Retail**
- Repositorio: [UCI Machine Learning Repository, dataset 352](https://archive.ics.uci.edu/dataset/352/online+retail)
- DOI: `10.24432/C5BW33`
- Licencia: CC BY 4.0
- Tamaño declarado: 541.909 registros
- Columnas: InvoiceNo, StockCode, Description, Quantity, InvoiceDate, UnitPrice, CustomerID, Country
- Fecha de descarga prevista: documentar localmente al obtener el archivo (esta plantilla no incluye el archivo)
- Transformación aplicada: **ninguna automática en Docker**. Si el archivo existe en `raw/`, el generador lee como máximo 20.000 filas para estimar cuantiles de `Quantity` y usarlos como `metadata.quantity_ref` en eventos sintéticos de venta.

**El dataset UCI no contiene fraude de SposaBella ni etiqueta de anomalía operativa.** No se reetiquetan facturas reales como fraude.

### 2. Datos sintéticos (escenarios de dominio)

Generados por `python generate_dataset.py` (`random_state=42`) en `synthetic/`.

Representan secuencias plausibles de boutique (login, ventas, stock, precio, administración). Las etiquetas `NORMAL`/`ANOMALO` salen **del escenario conocido**, no de UCI y no de una columna `anomaly_detected`.

### 3. Datos reales de SposaBella

Aún no se utilizan. Requieren historial suficiente de eventos emitidos por los microservicios de dominio.

## Cómo obtener UCI (manual, opcional)

No se descarga en `docker build`.

1. Descargar desde la URL UCI.
2. Colocar `online_retail.csv` o `Online Retail.xlsx` en `raw/`.
3. Volver a ejecutar `generate_dataset.py`.

## Posible segunda fuente (no usada en v1)

IEEE-CIS Fraud Detection (`isFraud`) es demasiado grande (~1,35 GB, cientos de columnas) para esta versión. Queda fuera del repositorio y del build.

## Salidas procesadas

- `processed/sposabella_training.csv` — conjunto balanceado de experimentación
- `processed/sposabella_training_imbalanced.csv` — misma generación, desbalance aproximado 9:1 para evaluación posterior
- `processed/dataset_manifest.json` — conteos y política de etiquetas
