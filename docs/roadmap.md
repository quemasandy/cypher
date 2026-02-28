# Roadmap

## Proposito
Traducir la vision y la arquitectura en hitos ejecutables con entregables jugables. Este roadmap prioriza progreso demostrable sobre expansion prematura del alcance.

## Decisiones
### Fase 0 - Documentacion fundacional
- Cerrar brief, GDD, glosario, arquitectura, ADRs y riesgos.
- Criterio de salida: sistema listo para scaffolding tecnico sin debates estructurales abiertos.

### Fase 1 - Nucleo del dominio
- Implementar `Case`, `Cipher`, `Agent`, `City`, `Location`, `Artifact`, value objects y eventos.
- Construir tests unitarios del dominio.
- Entregable: simulacion de un caso mediante tests y fixtures.

### Fase 2 - Casos de uso
- Implementar `StartCase`, `TravelToCity`, `VisitLocation`, `SubmitWarrant`, `GetCaseStatus`.
- Introducir puertos y dobles deterministas.
- Entregable: flujo completo jugable desde pruebas de aplicacion.

### Fase 3 - Generacion procedural y CLI
- Implementar pipeline por seed, validadores y `CLI adapter`.
- Entregable: MVP jugable en terminal, con victoria y derrota.

### Fase 4 - Persistencia local y web minima
- Sustituir `InMemoryCaseRepository` por `SQLiteCaseRepository`.
- Construir `web adapter` basico sobre los mismos casos de uso.
- Entregable: sesion persistente y demo web local.

### Fase 5 - Observabilidad y cloud futura
- Agregar telemetria estructurada.
- Documentar o implementar despliegue incremental segun prioridad real.
- Entregable: proyecto listo para exhibicion publica con operabilidad basica.

### Principios de priorizacion
- Cada fase termina con algo jugable o demostrable.
- Ninguna fase introduce infraestructura si el loop anterior aun no es confiable.
- El incremento tecnico debe dejar evidencia util para portfolio.

## Implicaciones
- La documentacion no es un paso ornamental; define la puerta de entrada a implementacion.
- La web y cloud son evoluciones condicionadas por el exito del MVP CLI.
- El roadmap reduce scope creep al fijar dependencias entre hitos.

## Fuera de alcance
- Roadmap comercial de marketing o monetizacion.
- Plan de staffing.
- Estimaciones detalladas de sprint por rol.

## Concepto de ingenieria
Un roadmap de ingenieria no enumera features; ordena reduccion de riesgo. Primero se valida el dominio, luego la orquestacion, luego la interfaz y por ultimo la infraestructura que complica operaciones.
