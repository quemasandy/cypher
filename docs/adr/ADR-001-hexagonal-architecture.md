# ADR-001: Adoptar arquitectura hexagonal con DDD en el nucleo

## Estado
Aprobado

## Proposito
Registrar por que `Cipher` usara `Ports & Adapters` y `DDD` como marco base del sistema.

## Decisiones
### Contexto
El proyecto debe poder evolucionar de `CLI` a web y de `in-memory` a `SQLite` o cloud sin reescribir reglas del negocio. Ademas, el principal valor del proyecto es demostrar criterio de modelado y desacoplamiento.

### Decision
Adoptar arquitectura hexagonal con `DDD` en el nucleo:
- `Domain` para reglas puras e invariantes.
- `Application` para casos de uso.
- `Ports` para side effects.
- `Adapters` para UI, persistencia y observabilidad.

### Alternativas consideradas
- `MVC` simple: mas rapido al inicio, pero mezcla logica de juego con adaptadores.
- `Framework-first`: acelera scaffolding, pero oculta limites del dominio.
- `Clean Architecture` con capas adicionales mas formales: valida, pero innecesariamente pesada para el alcance inicial.

## Implicaciones
- Aumenta el costo de setup inicial.
- Mejora testabilidad y reemplazo de adapters.
- Hace visible la disciplina arquitectonica como parte del valor del proyecto.

## Fuera de alcance
- Prescribir herramientas especificas de DI o frameworks.
- Event sourcing o mensajeria distribuida como requisito inicial.

## Concepto de ingenieria
Una decision arquitectonica fundacional debe registrarse cuando su costo es temprano y sus beneficios son futuros. El ADR evita rediscutir constantemente la misma eleccion y obliga a explicitar trade-offs.
