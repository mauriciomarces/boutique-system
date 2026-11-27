# Guía técnica de defensa de SposaBella

Guía de consulta basada en el estado del repositorio. Describe lo que se encuentra implementado, separa hechos de recomendaciones y señala límites que conviene exponer con honestidad. Las rutas de código y líneas citadas sirven para abrir directamente la evidencia en el IDE.

## Recorrido sugerido

1. [Arquitectura y componentes](./01_arquitectura_y_componentes.md): topología, responsabilidades, datos y comunicación.
2. [Guion de demostración](./02_guion_demostracion_sistema.md): recorrido integral, tiempos y comparación de escenarios.
3. [Guía de código por módulos](./03_guia_codigo_por_modulos.md): fragmentos esenciales para abrir y explicar.
4. [Inteligencia artificial](./04_explicacion_inteligencia_artificial.md): CART, vector, etiquetas, métricas, ejemplo reproducible y cautelas.
5. [Correlación lógica y eventos](./05_correlacion_logica_y_eventos.md): contrato, outbox, persistencia, ventanas y reglas.
6. [Preguntas del tribunal](./06_preguntas_y_respuestas_tribunal.md): preguntas probables y respuestas defendibles.
7. [Inventario de evidencias](./07_inventario_evidencias.md): capturas, pruebas y archivos a preparar.
8. [Auditoría documental](./08_auditoria_coherencia_documental.md): diferencias detectadas entre documentación y código.
9. [Glosario](./09_glosario_tecnico.md): términos explicados con el significado usado por el proyecto.
10. [Limitaciones y riesgos](./10_limitaciones_y_riesgos.md): aspectos pendientes, impacto y respuesta recomendada.

## Alcance y cautelas

- La implementación presenta un sistema de gestión de boutique con API Gateway, microservicios de dominio, eventos, correlación y clasificación experimental CART.
- Las etiquetas y escenarios del componente de IA son sintéticos. El resultado anómalo es una señal para revisión; no demuestra fraude.
- Las dos migraciones de apellidos son aditivas y no se han aplicado a ninguna base. La columna histórica `apellido` sigue en los esquemas como campo transitorio.
- El generador de datos tiene preview por defecto. No se ejecutó una carga contra MySQL ni contra el almacén SQLite persistente.
- Las métricas se identifican con su dataset, partición y fecha. No son resultados de producción ni certifican generalización a comportamiento real.
- No se encontró una memoria académica formal en `docs/` ni en `evidence/`; esta guía no inventa población, muestra, sprints ni conclusiones institucionales.

## Verificación de referencias

Las referencias de código usan `#L<n>` y se comprobaron contra el estado del repositorio al crear esta guía. Si una modificación posterior mueve líneas, se debe volver a verificar el número antes de usarlo durante la defensa.

