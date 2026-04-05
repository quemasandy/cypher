# First Vertical Slice Walkthrough

## Proposito
Documentar la primera base de codigo ejecutable de `Cipher`. Este walkthrough explica como se conectan dominio, aplicacion, contratos, infraestructura, CLI y web para abrir un caso, visitar una locacion, viajar a otra ciudad, emitir una warrant y resolver el caso desde adapters locales.

## Vision general
El vertical slice implementado recorre un flujo pequeno pero completo:
1. La CLI elige una `seed` reproducible.
2. La CLI invoca el caso de uso `StartCase`.
3. `StartCase` pide a `CaseGenerator` un aggregate en `Briefing` a partir de esa `seed`.
4. El aggregate cambia a `Investigating` y emite `CaseOpened`.
5. La aplicacion persiste el aggregate, publica eventos y registra telemetria.
6. La CLI imprime el estado inicial devuelto por `StartCase`.
7. La CLI invoca `VisitLocation` para inspeccionar una locacion de la ciudad actual.
8. El aggregate consume tiempo, revela la pista, emite `LocationVisited` y `ClueCollected`.
9. La aplicacion persiste el nuevo estado y la CLI imprime la vista actualizada.
10. La CLI invoca `TravelToCity` solo cuando una `route clue`, una `noise clue` o el historial de viaje ya revelaron un destino valido desde la ciudad actual.
11. El aggregate consume tiempo segun la conexion, actualiza la ciudad actual, emite `CityTraveled` y la CLI imprime el nuevo contexto sin exponer conexiones ocultas.
12. La CLI sigue inspeccionando locaciones hasta reunir suficiente evidencia de rasgos descubiertos.
13. La CLI invoca `SubmitWarrant` para comprometer una hipotesis legal sobre `Cipher` usando solo esa evidencia visible.
14. El aggregate registra la warrant, cambia a `WarrantIssued`, emite `WarrantIssued` y la CLI imprime la nueva fase del caso.
15. La CLI vuelve a viajar bajo warrant hasta alcanzar la ciudad final correcta.
16. El aggregate entra en `Chase`, la CLI invoca `AttemptArrest` y el caso termina en `Resolved` con captura o escape.

Ademas del walkthrough automatico, la CLI ahora expone un modo persistido por comandos pequenos:
- `start` crea un caso y lo guarda en `SQLite`.
- `status` o `resume` vuelve a leer el mismo caso desde disco.
- `visit`, `travel`, `warrant` y `arrest` aplican exactamente los mismos casos de uso sobre una sesion ya persistida.

Y la web ahora expone un adapter local minimo:
- `apps/web` levanta un server local y sirve una UI browser-based sobre los mismos casos de uso.
- La sesion del navegador persiste el aggregate activo en `localStorage` mediante un repositorio browser-safe.
- Un snapshot pequeno de la UI rehidrata tambien la seleccion de rasgos y la traza visible de eventos/telemetria.

## Mapa de archivos
- `packages/domain/src/case.ts`
  - Implementa el aggregate root y concentra la state machine inicial.
- `packages/domain/src/supporting-types.ts`
  - Define entidades y value objects pequenos que el aggregate necesita.
- `packages/application/src/start-case.ts`
  - Orquesta el flujo de inicio del caso desde una `seed`.
- `packages/application/src/visit-location.ts`
  - Orquesta la visita de una locacion y la publicacion de eventos resultantes.
- `packages/application/src/travel-to-city.ts`
  - Orquesta el viaje entre ciudades conectadas y la publicacion del evento de desplazamiento.
- `packages/application/src/submit-warrant.ts`
  - Orquesta la emision de la warrant y la publicacion del evento correspondiente.
- `packages/application/src/attempt-arrest.ts`
  - Orquesta el cierre del caso y la publicacion de eventos de resolucion.
- `packages/application/src/get-case-status.ts`
  - Expone la lectura del estado sin mutar el dominio.
- `packages/contracts/src/index.ts`
  - Define puertos abstractos para generacion, repositorio, aleatoriedad, eventos y telemetria.
- `packages/infra/src/in-memory-case-repository.ts`
  - Provee persistencia en memoria para demo y tests.
- `packages/infra/src/local-storage-case-repository.ts`
  - Provee persistencia local browser-safe sobre `localStorage` usando el mismo mapper de snapshots que `SQLite`.
- `packages/infra/src/browser-key-value-store.ts`
  - Define un contrato minimo para no acoplar infraestructura browser-safe al tipo `Storage` del DOM.
- `packages/infra/src/case-record-serialization.ts`
  - Traduce el aggregate `Case` a snapshots planos y lo rehidrata sin filtrar detalles de storage al dominio.
- `packages/infra/src/sqlite-case-repository.ts`
  - Provee persistencia local real sobre un archivo `SQLite` y demuestra reemplazo de adapter.
- `packages/infra/src/browser.ts`
  - Expone un entrypoint browser-safe para que la UI web no cargue adapters exclusivos de Node.
- `packages/infra/src/procedural-case-generator.ts`
  - Traduce una `seed` en un `Case` reproducible con validadores pequenos.
- `packages/infra/src/deterministic-randomness-provider.ts`
  - Provee elecciones estables para el pipeline procedural.
- `packages/infra/src/in-memory-support.ts`
  - Provee adapters simples para eventos, telemetria y una `seed` demo estable.
- `apps/cli/src/index.ts`
  - Cablea dependencias, acepta comandos de demo o sesion persistida y muestra el flujo completo en terminal.
- `apps/cli/src/cli-arguments.ts`
  - Traduce `argv` a comandos semanticos de CLI sin mezclar parseo con ejecucion.
- `apps/web/src/app.ts`
  - Proyecta el estado del caso a una UI local, rehidrata el caso persistido y traduce clicks del navegador a casos de uso.
- `apps/web/src/web-session-storage.ts`
  - Guarda solo el cascaron de la sesion web para que una recarga restaure la UI sin duplicar reglas del dominio.
- `apps/web/src/server.ts`
  - Sirve HTML, CSS, JS compilado y paquetes compartidos del monorepo para la demo web local.

## Nota de compilacion
El source del vertical slice esta escrito en `TypeScript`.
Cada paquete compila su salida a `dist/` y los tests se emiten a `dist-tests/` desde la raiz del repo.

## Encaje en la arquitectura
### Domain
`Case`, `CaseState`, `TimeBudgetHours` y los tipos de soporte viven en dominio porque representan reglas del juego y estado consistente del caso.

### Application
`StartCase`, `VisitLocation`, `TravelToCity`, `SubmitWarrant`, `AttemptArrest` y `GetCaseStatus` viven en aplicacion porque coordinan el aggregate con puertos externos y producen vistas consumibles por adapters.

### Contracts
`CaseGenerator`, `CaseRepository`, `RandomnessProvider`, `EventBus` y `Telemetry` viven en contratos porque definen que necesita la aplicacion sin decir como se implementa.

### Infrastructure
Los adapters `in-memory`, `SQLite`, el mapper de snapshots y el generador procedural viven en infraestructura porque resuelven side effects concretos: construir el caso, guardar, publicar, rehidratar y registrar.

### Interface
La CLI y la web viven en `apps/*` porque son adapters de entrada. Ninguna modifica entidades directamente; ambas invocan casos de uso.

## Como leer el codigo
1. Empieza por `apps/cli/src/index.ts` para ver el recorrido completo.
2. Sigue con `packages/application/src/start-case.ts` para ver la orquestacion.
3. Baja a `packages/domain/src/case.ts` para entender la mutacion real del aggregate.
4. Revisa `packages/contracts/src/index.ts` para ver que dependencias abstrae la aplicacion.
5. Termina en `packages/infra/src/*` para ver como se implementan esos puertos en esta fase.

## Que todavia no existe
- `API adapter`.
- Sincronizacion remota o multi-dispositivo.

## Por que este slice es util
Aunque pequeno, este slice ya prueba una afirmacion arquitectonica importante: el dominio puede mutar y la aplicacion puede orquestarlo sin acoplarse ni a un repositorio concreto ni a una sola interfaz. El mismo flujo hoy puede persistirse en memoria, en `SQLite` o en `localStorage`, puede jugarse por CLI o por web local, y el aggregate vuelve a levantarse como objeto de dominio real cuando el adapter lo necesita. La CLI, ademas, ya puede reanudar una sesion real entre procesos separados usando el mismo archivo `SQLite`, mientras que la web ahora demuestra una segunda superficie local con persistencia durable entre recargas usando adapters browser-safe. Ahora, ademas, el caso incluye dos filtros clave de conocimiento publico: la UI solo ve rasgos descubiertos y solo ve destinos respaldados por pistas de ruta o por historial de viaje. Eso vuelve mas honesto tanto el loop de deduccion como el de navegacion antes de expandirlos con mayor variedad de casos.
