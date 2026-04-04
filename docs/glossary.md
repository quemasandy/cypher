# Glossary

## Proposito
Congelar el lenguaje ubicuo del proyecto `Cipher`. Este documento define el significado operativo de los terminos usados por diseno, ingenieria y produccion para evitar ambiguedades en codigo, tests y decisiones de arquitectura.

## Decisiones
### Terminos del dominio
- `Agent`: detective controlado por el jugador. Es la perspectiva operativa del caso.
- `Artifact`: objeto historico robado que actua como disparador narrativo y vector de contexto del caso.
- `Case`: unidad completa de investigacion. Es el `aggregate root` y controla estado, timeline, pistas y resultado.
- `CaseState`: estado actual del caso (`Briefing`, `Investigating`, `WarrantIssued`, `Chase`, `Resolved`).
- `Cipher`: antagonista principal; ladron de elite modelado como entidad del dominio.
- `City`: nodo jugable de investigacion. Tiene metadata geografica, locaciones y conectividad.
- `Clue`: pieza de informacion obtenida al visitar una locacion. Puede apuntar a una siguiente ciudad o describir rasgos de `Cipher`.
- `ClueGraph`: estructura logica que conecta ciudades, locaciones y pistas de un caso.
- `Location`: punto investigable dentro de una ciudad, por ejemplo museo, aeropuerto o biblioteca.
- `Noise`: informacion deliberadamente imperfecta o ambigua que aumenta dificultad sin romper la resolubilidad.
- `Seed`: valor de entrada usado para reconstruir proceduralmente un caso.
- `TimeBudgetHours`: presupuesto de tiempo restante para resolver un caso.
- `TRACE`: agencia ficticia del jugador.
- `Trait`: rasgo observable de `Cipher`, como vehiculo, acento, habito o accesorio.
- `Warrant`: orden de captura emitida por el jugador a partir de rasgos deducidos.

### Eventos de dominio
- `CaseOpened`: el caso fue creado y quedo listo para investigacion.
- `CityTraveled`: el agente viajo a otra ciudad y consumio tiempo.
- `LocationVisited`: el agente visito una locacion y ejecuto una accion de investigacion.
- `ClueCollected`: una pista fue incorporada al caso.
- `WarrantIssued`: el jugador emitio una orden de captura.
- `CaseResolved`: el caso termino por arresto exitoso o por fracaso.
- `CipherEscaped`: `Cipher` escapo por agotamiento del tiempo o deduccion incorrecta.

### Casos de uso
- `StartCase`: crea y abre un caso reproducible desde una `seed`.
- `TravelToCity`: valida el viaje y descuenta horas.
- `VisitLocation`: inspecciona una locacion y retorna nuevas pistas.
- `SubmitWarrant`: valida rasgos deducidos y determina si la captura es legalmente valida.
- `AttemptArrest`: intenta cerrar el caso en la ciudad final con la warrant emitida.
- `GetCaseStatus`: expone el estado legible del caso para UI o CLI.

### Puertos
- `CaseGenerator`: construye un aggregate `Case` reproducible a partir de una `seed`.
- `CaseRepository`: almacenamiento y recuperacion del aggregate `Case`.
- `Clock`: fuente de tiempo abstracta para reglas y pruebas.
- `RandomnessProvider`: proveedor de aleatoriedad controlable y reproducible.
- `EventBus`: publicacion de eventos fuera del dominio.
- `Telemetry`: observabilidad y metricas fuera del dominio.

## Implicaciones
- Los nombres de clases, DTOs, eventos y tests deben respetar este glosario.
- Si un termino cambia semanticamente, debe actualizarse aqui antes de propagarse al codigo.
- Los ADRs y diagramas deben usar exactamente estos nombres cuando apliquen.

## Fuera de alcance
- Terminologia de UI cosmetica.
- Nombres internos de frameworks, librerias o herramientas de build.
- Nombres provisionales de features aun no priorizadas.

## Concepto de ingenieria
El lenguaje ubicuo de `DDD` reduce friccion cognitiva. Cuando diseno, codigo y tests comparten el mismo vocabulario, disminuyen las traducciones implicitas y aparecen menos errores por interpretacion.
