# Instrucciones de Copilot para `Cipher`

Este repositorio es didactico. La prioridad no es solo entregar codigo correcto, sino producir codigo que una persona principiante pueda leer y entender.

## Al generar codigo
- Empieza cada archivo nuevo con un comentario de cabecera que explique el objetivo del archivo, su responsabilidad y su lugar dentro de la arquitectura.
- Usa nombres explicitos y evita abreviaturas dificiles de interpretar.
- Agrega comentarios cerca del codigo para explicar pasos no triviales, validaciones, decisiones de modelado, flujo de datos e invariantes.
- Si varias lineas consecutivas implementan una sola idea, puedes usar un comentario de microbloque antes del grupo en lugar de comentarios redundantes en cada linea.
- Prefiere implementaciones simples y progresivas antes que abstracciones compactas pero opacas.

## Al responder o explicar
- Explica primero el contexto general del archivo.
- Explica despues como ese archivo encaja en la arquitectura del proyecto.
- Describe el comportamiento del codigo paso a paso cuando el cambio sea importante para aprendizaje.
- Si tocas dominio o arquitectura, conecta la explicacion con `docs/architecture/` y `docs/adr/`.

## Restricciones de arquitectura
- Respetar `DDD`, `Ports & Adapters`, `CLI-first` y `local-first`.
- No mover logica de dominio a adaptadores o capas externas.
- Si una decision cambia la arquitectura, sugerir o realizar la actualizacion documental correspondiente.
