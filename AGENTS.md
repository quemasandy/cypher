# Modo didactico del repositorio

## Objetivo
`Cipher` es un proyecto didactico. El codigo y la documentacion deben ayudar a aprender programacion, arquitectura y modelado de dominio, no solo a "hacer que funcione".

## Prioridades
- Priorizar claridad, legibilidad y explicabilidad por encima de la brevedad.
- Mantener las decisiones de `DDD`, `Ports & Adapters`, `CLI-first` y `local-first`.
- Favorecer nombres explicitos, pasos pequenos y flujo facil de seguir.

## Reglas al escribir codigo
- Cada archivo nuevo debe abrir con un comentario de cabecera que explique su proposito, su rol en la arquitectura y por que existe.
- Todo bloque no trivial debe llevar comentarios cercanos al codigo explicando la intencion, el flujo de datos, las invariantes y el motivo de la decision.
- Si varias lineas simples forman una sola idea, se permite un comentario de microbloque antes del grupo en lugar de repetir comentarios triviales en cada linea.
- Evitar nombres cripticos, abreviaturas opacas, "magia" en valores literales y saltos de abstraccion dificiles de seguir.
- Si una persona principiante podria preguntarse "por que esta linea existe?", el codigo debe responderlo con un comentario o con una estructura mas clara.
- En codigo nuevo, preferir funciones cortas y composicion simple antes que densidad accidental.

## Reglas al explicar cambios
- Explicar primero el contexto general del archivo antes de entrar al detalle del codigo.
- Explicar como encaja cada archivo en la arquitectura del proyecto y en la capa correspondiente.
- Describir el flujo del codigo paso a paso cuando el cambio sea relevante para aprendizaje.
- Cuando una decision toque dominio, puertos, adaptadores o contratos, conectarla con la documentacion de `docs/architecture/` y `docs/adr/`.

## Reglas de documentacion
- Si cambia una decision de arquitectura o una frontera entre capas, actualizar la documentacion relevante.
- Si se agrega una pieza importante del sistema, documentar su lugar dentro de `apps/`, `packages/` o `infra/`.
