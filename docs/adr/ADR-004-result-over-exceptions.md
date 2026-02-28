# ADR-004: Usar Result<T, E> en Application en vez de excepciones para control de flujo

## Estado
Aprobado

## Proposito
Registrar el manejo canonico de errores y resultados de casos de uso.

## Decisiones
### Contexto
Los casos de uso de `Cipher` deben expresar fallos esperables del dominio: tiempo insuficiente, transicion invalida, case inexistente, warrant incompatible. Estos fallos no son excepcionales desde la perspectiva del sistema.

### Decision
Los casos de uso de `Application` retornaran `Result<T, E>` para errores esperables. Las excepciones quedaran reservadas para fallos tecnicos inesperados o violaciones no recuperables.

### Alternativas consideradas
- `throw/catch` para todo: mas familiar, pero menos explicito en contratos de use case.
- `null` o valores centinela: ambiguos y faciles de ignorar.

## Implicaciones
- Los contratos de aplicacion seran mas verbosos pero mas legibles.
- CLI y web deberan mapear errores esperables a mensajes o estados de UI sin depender de excepciones.
- El testing de paths invalidos sera mas directo.

## Fuera de alcance
- Imponer `Result` en cada detalle del dominio si no aporta claridad.
- Reemplazar por completo el manejo de excepciones tecnicas de bajo nivel.

## Concepto de ingenieria
`Result<T, E>` hace explicitos los caminos validos y fallidos de un caso de uso. Esto mejora composicion, testabilidad y lectura de contratos, especialmente cuando el dominio tiene varias formas legitimas de rechazar una accion.
