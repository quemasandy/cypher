# Testing Strategy

## Proposito
Definir como se va a validar el sistema antes y durante la implementacion. La estrategia de pruebas debe proteger dominio, casos de uso, generacion procedural y limites arquitectonicos.

## Decisiones
### Niveles de prueba
#### Unit tests de dominio
- Validan invariantes de `Case`, `Warrant`, `TimeBudgetHours`, `Trait` y eventos.
- No dependen de frameworks ni IO.

#### Application tests
- Validan casos de uso end-to-end sobre doubles o adapters concretos (`in-memory` y `SQLite` cuando el cambio de adapter es parte del riesgo a cubrir).
- Cubren:
  - `StartCase`
  - `TravelToCity`
  - `VisitLocation`
  - `SubmitWarrant`
  - `AttemptArrest`
  - `GetCaseStatus`

#### Infrastructure integration tests
- Validan adapters concretos con IO real cuando el valor arquitectonico depende del adapter.
- En el estado actual cubren roundtrip de `SQLiteCaseRepository` para demostrar persistencia y rehidratacion del aggregate.

#### CLI integration tests
- Validan el adapter de terminal como proceso real cuando la UX del adapter forma parte del slice.
- En el estado actual cubren `start -> visit -> travel -> status` sobre varias ejecuciones separadas compartiendo el mismo archivo `SQLite`.

#### Generative / property-like tests
- Verifican que toda `seed` valida produzca un caso resoluble.
- Verifican que la misma `seed` reconstruya exactamente el mismo caso.
- Detectan colisiones de ruido, rutas imposibles o budgets inviables.

#### Architecture tests
- Verifican reglas de dependencia entre paquetes.
- Previenen imports ilegales desde `domain` hacia `infra` o `apps`.

#### Acceptance scenarios
- Casos narrativos completos que prueban ganar, perder por tiempo y perder por warrant incorrecta.
- Deben recorrer los mismos casos de uso que usa la CLI, no helpers paralelos del dominio.

### Cobertura objetivo
- Prioridad alta en dominio y casos de uso.
- Cobertura menor pero critica en generadores y validadores.
- La cobertura numerica no reemplaza calidad de escenarios.

### Estrategia de doubles
- `InMemoryCaseRepository` como adapter de prueba y de MVP.
- `SQLiteCaseRepository` como adapter de integracion para validar reemplazo real de persistencia local.
- `ProceduralCaseGenerator` como generador concreto del slice actual.
- `DeterministicRandomnessProvider` para reproducir seeds.
- `FakeClock` para controlar tiempo sin depender de reloj real.
- `SpyEventBus` y `SpyTelemetry` para verificar side effects externos.

### Criterios de aceptacion minimos
- Crear un caso reproducible desde una seed.
- Consumir tiempo correctamente al viajar.
- Recolectar pistas coherentes por locacion.
- Impedir transiciones invalidas de estado.
- Resolver correctamente un arresto exitoso y uno fallido.
- Cambiar repository sin romper reglas del dominio.

### Documentacion viva
- Los nombres de tests deben expresarse en lenguaje del dominio.
- Los escenarios BDD funcionan como especificacion ejecutable.
- Cada bug sistemico debe incorporar una prueba de regresion.

## Implicaciones
- El diseno de puertos debe facilitar pruebas deterministicas.
- Si algo no puede probarse sin bootstrapping complejo, probablemente esta mal ubicado arquitectonicamente.
- La estrategia de generacion procedural exige validacion automatica desde el inicio.
- La migracion de repositorios no se considera cerrada hasta que exista al menos una prueba con IO real que reabra el caso desde otra instancia del adapter.

## Fuera de alcance
- Tests E2E de browser en la fase documental.
- Benchmarks de rendimiento.
- Chaos testing o resiliencia distribuida temprana.

## Concepto de ingenieria
Las pruebas no solo validan codigo; fijan comportamiento. En este proyecto, el mayor valor esta en pruebas que documenten reglas del dominio y propiedades del generador, porque ahi vive la mayor parte del riesgo real.
