# Cipher

`Cipher` es un juego de investigacion procedural `single-player` construido como proyecto de portfolio tecnico. El jugador encarna a un detective de `TRACE` que persigue a un ladron de elite conocido como `Cipher` a traves de ciudades internacionales, bajo presion de tiempo y con informacion incompleta.

## Proposito
- Establecer una fuente de verdad previa al codigo.
- Definir el producto, el dominio y la arquitectura antes del scaffolding tecnico.
- Demostrar practicas de ingenieria aplicadas: `DDD`, `Hexagonal Architecture`, `ADR`, documentacion viva y evolucion incremental de infraestructura.

## Modo didactico
Este repositorio se mantiene en modo didactico. El codigo nuevo debe priorizar claridad pedagogica: contexto por archivo, comentarios cercanos al codigo, nombres explicitos y explicaciones de como cada pieza encaja en la arquitectura.

Las instrucciones persistentes para agentes y asistentes viven en `AGENTS.md` y `.github/copilot-instructions.md`. Cuando varias lineas simples forman un unico paso, pueden agruparse bajo un comentario corto para evitar ruido visual innecesario.

## Primer vertical ejecutable
La primera base de codigo ya existe como un `vertical slice` pequeno y didactico:
- `packages/domain/` contiene el aggregate root `Case`, estados, value objects y entidades de soporte.
- `packages/application/` contiene `StartCase`, `VisitLocation`, `TravelToCity`, `SubmitWarrant`, `AttemptArrest` y `GetCaseStatus`.
- `packages/contracts/` define los puertos abstractos.
- `packages/infra/` contiene adapters `in-memory`, `SQLite`, `localStorage`, telemetria estructurada en JSONL, un mapper de rehidratacion del aggregate y el generador procedural determinista por `seed`.
- `apps/cli/` contiene la demo ejecutable en terminal con investigacion, viaje, warrant, resolucion final y arranque reproducible por `seed`.
- `apps/web/` contiene la version web local-first final del roadmap actual, montada sobre los mismos casos de uso, con dossier guiado, exporte de reportes y sesion durable en browser.

### Comandos
```bash
npm install
npm run build
npm test
npm run demo
npm run web
npm run web:start
npm run web:bundle
npm run web:bundle:start
npm run web:container:build
npm run web:container:run
npm run demo -- tutorial-case-v1
npm run demo -- start tutorial-case-v1
npm run demo -- status <caseId>
npm run demo -- visit <caseId>
npm run demo -- travel <caseId>
npm run demo -- warrant <caseId>
npm run demo -- arrest <caseId>
```

El codigo fuente del vertical slice vive ahora en `TypeScript` y cada paquete compila sus artefactos a `dist/`. Los tests compilados se emiten a `dist-tests/` para no mezclar build de producto con build de pruebas.

La CLI ahora tiene dos modos:
- `demo`: recorre automaticamente un caso completo como walkthrough ejecutable.
- `command mode`: abre y reanuda casos persistidos en `SQLite`, por defecto en `.local/cipher-cli.sqlite`.
- `command mode` tambien deja una traza durable de observabilidad en `.local/cipher-cli.telemetry.jsonl`, o en la ruta indicada por `--telemetry-file`.

La web ahora expone un tercer modo de uso:
- `web adapter`: levanta una interfaz local en `http://localhost:4173` con una sesion durable en `localStorage`, barra de progreso, accion recomendada, reporte exportable y modo fullscreen, usando los mismos casos de uso que CLI y tests.
- `web adapter` tambien expone `GET /healthz` y logs estructurados de arranque/requests para un despliegue incremental pequeno.
- `web:bundle`: prepara un artefacto portable en `.deploy/web/` con solo los archivos necesarios para arrancar el adapter fuera del monorepo.
- `web:container:*`: construye y ejecuta una imagen Docker local desde ese bundle portable.

### Walkthroughs
- `docs/walkthroughs/first-vertical-slice.md`
- `docs/templates/file-walkthrough-template.md`

## Decisiones
- `Cipher` es el antagonista; el jugador es un detective de `TRACE`.
- El primer ejecutable planeado es `CLI-first`, `local-first`.
- El recurso principal del juego son `horas virtuales`.
- La arquitectura base es `Ports & Adapters` con `DDD` en el nucleo.
- El baseline tecnico recomendado es `TypeScript/Node`, con evolucion posterior a `React` y cloud.

## Implicaciones
- El proyecto se puede implementar por capas sin redefinir reglas del negocio.
- La UI web local final ya no altera ni el dominio ni la capa de aplicacion; consume exactamente los mismos casos de uso del resto del repo mientras agrega presentacion, exporte y operabilidad sin romper la frontera hexagonal.
- La CLI ya no solo persiste estado del caso: tambien deja evidencia estructurada del flujo tecnico en un archivo local-first facil de inspeccionar.
- Las decisiones arquitectonicas quedan registradas en `docs/adr/` para evitar drift de contexto.

## Fuera de alcance
- Multiplayer, monetizacion, live ops, IA generativa en runtime y cloud obligatoria desde el MVP.
- Arte final y pipeline audiovisual completo.

## Concepto de ingenieria
La documentacion inicial prioriza `contexto durable` sobre explicaciones triviales del codigo. El objetivo no es comentar implementaciones futuras, sino fijar el por que de las decisiones, las invariantes del dominio y los contratos entre capas.

## Corpus documental
- [Game Brief](docs/brief/game-brief.md)
- [Game Design Document](docs/product/game-design-document.md)
- [Core Loop and Progression](docs/product/core-loop-and-progression.md)
- [Glossary](docs/glossary.md)
- [Architecture Overview](docs/architecture/overview.md)
- [C4 and Boundaries](docs/architecture/c4-and-boundaries.md)
- [Domain Model](docs/architecture/domain-model.md)
- [Procedural Generation](docs/architecture/procedural-generation.md)
- [State Machine](docs/architecture/state-machine.md)
- [Testing Strategy](docs/architecture/testing-strategy.md)
- [Roadmap](docs/roadmap.md)
- [Risks and Open Questions](docs/risks-and-open-questions.md)
- [Local Environment Notes](docs/development/local-environment.md)
- [Incremental Web Deployment](docs/development/incremental-web-deployment.md)
- [ADRs](docs/adr/)

## Topologia objetivo del repositorio
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
  docker/
  cdk/
docs/
```

## Regla operativa
No se inicia implementacion hasta que el loop principal, el modelo de dominio, los puertos y la estrategia de generacion procedural esten definidos y no se contradigan entre si.
