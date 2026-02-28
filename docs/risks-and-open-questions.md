# Risks and Open Questions

## Proposito
Registrar riesgos tecnicos y de producto que pueden comprometer claridad, alcance o calidad de `Cipher`. Este documento hace explicitas las incertidumbres para que no se conviertan en deuda silenciosa.

## Decisiones
### Riesgos principales
#### Sobredisenio arquitectonico
- Riesgo: modelar demasiadas capas o patrones antes de validar el loop.
- Mitigacion: cada fase debe producir un entregable jugable; cualquier nueva abstraccion debe resolver un dolor actual o futuro ya documentado.

#### Generacion procedural no resoluble
- Riesgo: producir casos con rutas imposibles, tiempo insuficiente o warrants sin evidencia.
- Mitigacion: validadores obligatorios, seeds reproducibles y tests generativos.

#### Vocabulario inconsistente
- Riesgo: divergencia entre terminologia de GDD, dominio y codigo.
- Mitigacion: `docs/glossary.md` como fuente de verdad y revisiones contra ADRs.

#### Scope creep
- Riesgo: introducir multiplayer, IA generativa, mobile o live ops antes de cerrar el MVP.
- Mitigacion: declarar fuera de alcance y exigir ADR para toda expansion mayor.

#### Contaminacion del dominio
- Riesgo: acoplar `Case` o casos de uso a UI, DB o frameworks.
- Mitigacion: architecture tests y revisiones de imports por capa.

### Riesgos secundarios
- Complejidad excesiva de la `Warrant`.
- CLI pobremente presentada que opaque el valor del loop.
- Dificultad mal calibrada entre tiers.
- Falta de trazabilidad entre seed, pistas y solucion final.

### Open questions actuales
- Formula exacta de costo de viaje: geografica real vs tiers abstractos.
- Cantidad inicial de ciudades y locaciones del pool MVP.
- Conjunto minimo de `Trait` requerido para una `Warrant` valida.
- Alcance del `apps/api` en la primera iteracion web.
- Nivel de detalle de telemetria a instrumentar antes del deploy publico.

### Criterios para cerrar una open question
- Debe afectar una interfaz, una invariante o una decision de roadmap.
- Debe resolverse con evidencia de prototipo, test o ADR.
- Si no cambia implementacion ni arquitectura, no merece quedar abierta.

## Implicaciones
- Los riesgos no eliminados deben revaluarse al final de cada fase.
- Toda pregunta abierta debe tener un owner y un momento de cierre antes de bloquear implementacion relevante.
- El roadmap puede cambiar, pero los riesgos deben documentarse cuando lo hagan.

## Fuera de alcance
- Registro exhaustivo de tareas menores.
- Riesgos comerciales o legales externos al proyecto actual.
- Matriz formal de compliance.

## Concepto de ingenieria
Hacer visibles los riesgos reduce deuda de coordinacion. En sistemas pequenos, los mayores problemas suelen venir de supuestos no explicitados, no de falta de herramientas.
