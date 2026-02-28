# ADR-005: Evolucion de persistencia local-first

## Estado
Aprobado

## Proposito
Registrar la estrategia de evolucion de persistencia del proyecto.

## Decisiones
### Contexto
El proyecto comienza con un repositorio vacio y debe priorizar validacion del dominio. Introducir cloud desde el inicio agregaria costos operativos y complejidad antes de demostrar que el juego funciona.

### Decision
Adoptar una ruta progresiva:
1. `InMemoryCaseRepository`
2. `SQLiteCaseRepository`
3. adapters cloud si y solo si el roadmap lo requiere

### Alternativas consideradas
- `JSON file` como etapa intermedia: valida para prototipos, pero menos util que `SQLite` para demostrar reemplazo de adapters con una persistencia mas seria.
- `DynamoDB` temprana: alinea con una vision cloud, pero aumenta complejidad sin reducir el riesgo principal.

## Implicaciones
- El repository debe abstraer detalles de almacenamiento desde el inicio.
- Persistencia local suficiente permite iterar sin dependencia de despliegue.
- La ruta elegida demuestra valor de la arquitectura de forma tangible.

## Fuera de alcance
- Estrategia multi-tenant.
- Sincronizacion online/offline.
- Replicacion distribuida.

## Concepto de ingenieria
Una ruta `local-first` prioriza tiempo de aprendizaje y evidencia tecnica. La infraestructura debe entrar cuando habilita el siguiente riesgo importante, no antes.
