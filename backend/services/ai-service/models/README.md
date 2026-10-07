# Modelos versionados

Cada entrenamiento crea `models/vN/` sin borrar versiones anteriores.

`decision_tree.joblib` en la raíz de este directorio es el **puntero al modelo actual** (copia de la última iteración).

Los `.joblib` no se versionan en Git.
