# First Vertical Slice Walkthrough

## Proposito
Documentar la primera base de codigo ejecutable de `Cipher`. Este walkthrough explica como se conectan dominio, aplicacion, contratos, infraestructura y CLI para abrir un caso desde terminal.

## Vision general
El vertical slice implementado recorre un flujo pequeno pero completo:
1. Se construye un `Case` en estado `Briefing`.
2. La CLI invoca el caso de uso `StartCase`.
3. `StartCase` carga el aggregate desde `CaseRepository`.
4. El aggregate cambia a `Investigating` y emite `CaseOpened`.
5. La aplicacion persiste el aggregate, publica eventos y registra telemetria.
6. La CLI consulta `GetCaseStatus` e imprime una vista amigable.

## Mapa de archivos
- `packages/domain/src/case.ts`
  - Implementa el aggregate root y concentra la state machine inicial.
- `packages/domain/src/supporting-types.ts`
  - Define entidades y value objects pequenos que el aggregate necesita.
- `packages/application/src/start-case.ts`
  - Orquesta el flujo de inicio del caso.
- `packages/application/src/get-case-status.ts`
  - Expone la lectura del estado sin mutar el dominio.
- `packages/contracts/src/index.ts`
  - Define puertos abstractos para repositorio, eventos y telemetria.
- `packages/infra/src/in-memory-case-repository.ts`
  - Provee persistencia en memoria para demo y tests.
- `packages/infra/src/in-memory-support.ts`
  - Provee adapters simples para eventos, telemetria y una factoria de caso demo.
- `apps/cli/src/index.ts`
  - Cablea dependencias y muestra el flujo completo en terminal.

## Nota de compilacion
El source del vertical slice esta escrito en `TypeScript`.
Cada paquete compila su salida a `dist/` y los tests se emiten a `dist-tests/` desde la raiz del repo.

## Encaje en la arquitectura
### Domain
`Case`, `CaseState`, `TimeBudgetHours` y los tipos de soporte viven en dominio porque representan reglas del juego y estado consistente del caso.

### Application
`StartCase` y `GetCaseStatus` viven en aplicacion porque coordinan el aggregate con puertos externos y producen vistas consumibles por adapters.

### Contracts
`CaseRepository`, `EventBus` y `Telemetry` viven en contratos porque definen que necesita la aplicacion sin decir como se implementa.

### Infrastructure
Los adapters `in-memory` viven en infraestructura porque resuelven side effects concretos: guardar, publicar y registrar.

### Interface
La CLI vive en `apps/cli` porque es un adapter de entrada. No modifica entidades directamente; solo invoca casos de uso.

## Como leer el codigo
1. Empieza por `apps/cli/src/index.ts` para ver el recorrido completo.
2. Sigue con `packages/application/src/start-case.ts` para ver la orquestacion.
3. Baja a `packages/domain/src/case.ts` para entender la mutacion real del aggregate.
4. Revisa `packages/contracts/src/index.ts` para ver que dependencias abstrae la aplicacion.
5. Termina en `packages/infra/src/*` para ver como se implementan esos puertos en esta fase.

## Que todavia no existe
- Viajes entre ciudades.
- Visitas a locaciones como caso de uso propio.
- Warrants y resolucion final.
- Generacion procedural por `seed`.
- Persistencia `SQLite`.

## Por que este slice es util
Aunque pequeno, este slice ya prueba una afirmacion arquitectonica importante: el dominio puede mutar y la aplicacion puede orquestarlo sin acoplarse a la CLI ni a una base de datos real. Eso reduce riesgo antes de expandir el loop del juego.
