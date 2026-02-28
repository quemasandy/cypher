# Game Brief - Cipher

## Proposito
Definir el marco ejecutivo del proyecto: vision, audiencia, propuesta de valor, restricciones y criterio de exito. Este documento es la referencia primaria para alinear diseno, ingenieria y produccion.

## Decisiones
### Vision
`Cipher` es un juego de investigacion internacional donde el jugador persigue a un ladron de elite a traves de una cadena de ciudades conectadas por pistas. La tension central combina deduccion, administracion de tiempo y presion de captura.

### Audiencia objetivo
- Principal: desarrolladores y hiring managers que evaluan criterio de arquitectura, modelado de dominio y capacidad de entrega incremental.
- Secundaria: jugadores que disfrutan investigacion, deduccion y progression loops claros.

### Propuesta de valor
- Casos reproducibles por `seed`, pero con variacion suficiente para demostrar generacion procedural.
- Dominio rico y desacoplado de UI, persistencia e infraestructura.
- Cada fase del proyecto termina en un incremento jugable y demostrable.

### Pilares de experiencia
1. `Investigacion bajo presion`: cada accion consume horas y obliga a priorizar.
2. `Deduccion explicable`: las pistas deben permitir reconstruir por que un caso era resoluble.
3. `Arquitectura visible`: el valor del proyecto esta tanto en el juego como en la claridad tecnica.
4. `Escalado controlado`: `Cipher` se vuelve mas sofisticado sin romper la legibilidad del sistema.

### Tono y direccion creativa
- Thriller internacional con estetica noir y operativa de agencia.
- Lenguaje sobrio, orientado a dossier, bitacora y sala de investigacion.
- La fantasia visual futura puede ser estilizada, pero no debe gobernar el diseno del nucleo.

### Restricciones iniciales
- `Single-player`.
- MVP `CLI-first`, `local-first`.
- `TypeScript/Node` como baseline tecnico.
- Persistencia inicial `in-memory`, luego `SQLite`.
- Cloud y web como etapas de evolucion, no como dependencia de arranque.

### Objetivos
- Fijar una fuente de verdad completa antes del codigo.
- Crear un portfolio piece defendible en entrevistas tecnicas.
- Probar que el dominio soporta multiples adapters sin reescritura del nucleo.

### No-objetivos
- Competir en contenido o produccion audiovisual con juegos comerciales.
- Optimizar monetizacion, retention loops avanzados o features sociales.
- Introducir complejidad de infraestructura antes de validar el loop central.

## Implicaciones
- Las decisiones de producto se evaluan segun su impacto en claridad del dominio y demostrabilidad tecnica.
- El MVP debe ser suficientemente pequeno para cerrar un caso completo, pero suficientemente rico para exhibir arquitectura.
- La narrativa queda subordinada a la coherencia sistemica: toda fantasia debe poder modelarse.

## Fuera de alcance
- Multiplayer, coop y PvP.
- Economias `free-to-play`.
- IA generativa para dialogos en runtime.
- Live ops, eventos temporales y telemetria avanzada desde dia uno.

## Concepto de ingenieria
Un `Game Brief` no describe implementacion. Captura contexto, restricciones y criterios de exito para reducir decisiones duplicadas aguas abajo. Su funcion es evitar que el equipo discuta arquitectura con supuestos de producto no explicitados.
