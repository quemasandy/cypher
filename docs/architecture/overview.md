# Architecture Overview

## Proposito
Describir la arquitectura objetivo de `Cipher`, sus capas, responsabilidades y reglas de dependencia. Este documento sirve como vista de alto nivel para cualquier implementador antes de abrir codigo.

## Decisiones
### Estilo arquitectonico
- `Hexagonal Architecture` como patron principal.
- `DDD` en el nucleo para modelar reglas del juego.
- `Application layer` para orquestar casos de uso.
- `Ports` explicitos para generacion de casos, persistencia, aleatoriedad, tiempo, eventos y telemetria.
- `Adapters` intercambiables para `CLI`, web, almacenamiento local y cloud futura.

### Principios de acoplamiento
- El dominio no conoce frameworks, IO, base de datos ni UI.
- La capa de aplicacion depende del dominio y de contratos abstractos.
- Los adapters dependen de los puertos definidos por capas internas.
- Ninguna UI accede directo al almacenamiento ni a servicios de infraestructura.

### Topologia recomendada
```text
apps/
  cli/
  web/
  api/
packages/
  domain/
  application/
  infra/
  contracts/
infra/
  cdk/
docs/
```

### Responsabilidades por capa
#### Domain
- Entidades, value objects, aggregate roots y eventos de dominio.
- Reglas de negocio puras.
- Invariantes del juego.

#### Application
- Casos de uso.
- Coordinacion transaccional.
- Mapeo entre comandos de entrada y cambios del dominio.
- Produccion de DTOs o view models para capas externas.

#### Ports
- Interfaces que abstraen side effects.
- Contratos de salida que la infraestructura debe cumplir.
- Incluyen `CaseGenerator`, `CaseRepository`, `RandomnessProvider`, `EventBus` y `Telemetry`.

#### Infrastructure
- Repositorios concretos.
- `CaseGenerator`, `RandomnessProvider`, `Clock`, `EventBus`, `Telemetry` concretos.
- Adaptadores a `SQLite`, `localStorage`, file storage, backend HTTP o cloud futura.
- En el estado actual, la observabilidad local se resuelve con `InMemoryTelemetry`, `CompositeTelemetry` y `StructuredFileTelemetry`.
- Mappers de persistencia que traduzcan aggregates a snapshots planos cuando un adapter lo necesite.
- Entry points browser-safe cuando una UI web deba reutilizar la infraestructura sin cargar adapters exclusivos de Node.
- En el estado actual, `infra/docker` empaqueta el adapter web como runtime generico sin introducir todavia una plataforma cloud.

#### Interface
- `CLI` para el MVP.
- `Web UI` local-first final como segundo adapter real, con briefing guiado, progreso visible, exporte de reportes y continuidad de sesion en browser.
- `API` como adapter adicional futuro.

### Interfaces canonicas de aplicacion
- Casos de uso de entrada:
  - `StartCase`
  - `TravelToCity`
  - `VisitLocation`
  - `SubmitWarrant`
  - `AttemptArrest`
  - `GetCaseStatus`
- Regla de salida:
  - los adapters solo consumen `DTOs` o `view models` emitidos por `Application`,
  - nunca leen `repositories` ni detalles de infraestructura,
  - nunca mutan entidades del dominio por fuera de un caso de uso.

### Evolucion tecnica planeada
1. `CLI + InMemoryCaseRepository`
2. `CLI + SQLiteCaseRepository`
3. `CLI/Web + SQLiteCaseRepository y LocalStorageCaseRepository`
4. `CLI + SQLiteCaseRepository + StructuredFileTelemetry`
5. `Web final local-first + bundle portable + generic container runtime`
6. `Web/API + cloud adapters`

## Implicaciones
- La arquitectura exige mas disciplina inicial, pero reduce costo de cambio futuro.
- El reemplazo de adapters debe validarse con tests de aplicacion y contratos.
- La estructura de carpetas tiene que reflejar los limites conceptuales, no solo preferencias cosmeticas.
- Cuando un adapter necesita serializar aggregates complejos, la traduccion debe vivir fuera de `domain` para conservar el nucleo libre de detalles de storage.
- La observabilidad tambien sigue el contrato hexagonal: la aplicacion solo conoce `Telemetry`, mientras CLI decide si fan-out a memoria, archivo local o futuros destinos remotos.

## Fuera de alcance
- Microservicios.
- Event sourcing completo.
- Infra distribuida desde el MVP.
- CQRS separado como requisito inicial.

## Concepto de ingenieria
`Ports & Adapters` no es una meta estetica. Su valor aparece cuando cambian UI o persistencia sin reescribir reglas del negocio. En un proyecto de portfolio, esto permite demostrar independencia del dominio con evidencia concreta.
