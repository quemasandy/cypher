# Game Design Document

## Proposito
Formalizar las reglas jugables de `Cipher`: loop, condiciones de victoria y derrota, estructura del caso, dificultad y progresion. Este documento traduce la vision del brief a reglas operables.

## Decisiones
### Premisa jugable
Cada caso comienza con el robo de un `Artifact` en una `City` inicial. El jugador, como agente de `TRACE`, recibe contexto minimo, viaja entre ciudades, investiga locaciones, recolecta pistas y emite una `Warrant` para capturar a `Cipher` antes de que agote el tiempo.

### Flujo del caso
1. `Briefing`: reporte de robo, artifacto, ciudad inicial y presupuesto de tiempo.
2. `Investigating`: el jugador visita locaciones y viaja entre ciudades.
3. `WarrantIssued`: el jugador cree conocer la identidad operativa de `Cipher`.
4. `Chase`: persecucion final hacia la ciudad objetivo.
5. `Resolved`: arresto exitoso o escape.

### Reglas principales
- Toda accion significativa consume `horas virtuales`.
- Viajar cambia la ciudad actual y consume tiempo proporcional a la distancia o tier de viaje.
- Visitar una `Location` consume tiempo fijo y otorga una o mas `Clues`.
- Las pistas se dividen en:
  - `Route clues`: apuntan a la siguiente ciudad o acotan el destino correcto.
  - `Trait clues`: describen rasgos necesarios para emitir la `Warrant`.
- La mayoria de las pistas son verdaderas; un subconjunto controlado puede ser ambiguo o falso.
- El caso solo puede ganarse si el jugador:
  - llega a la ciudad final correcta,
  - antes de agotar el tiempo,
  - y con una `Warrant` compatible con los rasgos de `Cipher`.

### Condiciones de victoria
- `Cipher` es arrestado en la ciudad correcta.
- La `Warrant` coincide con el conjunto minimo de rasgos requeridos.
- El tiempo restante es mayor que cero al momento de la captura.

### Condiciones de derrota
- El tiempo llega a cero.
- El jugador arresta con una `Warrant` incorrecta.
- El jugador sigue una cadena de deducciones incompatible y no alcanza la ciudad final a tiempo.

### Dificultad
- La dificultad aumenta por capas:
  - mas ciudades potenciales en el grafo,
  - mayor presupuesto de ruido,
  - mas rasgos requeridos para la `Warrant`,
  - trayectorias de viaje mas caras,
  - locaciones con valor desigual.
- El escalado debe aumentar complejidad de decision, no arbitrariedad.

### Progresion
- Cada caso completado incrementa la sofisticacion operativa de `Cipher`.
- La progresion inicial es horizontal y didactica: introduce nuevas formas de pistas y reglas, no solo penalizaciones numericas.
- La metaprogression futura puede incluir historial de capturas, ranking del detective y casos de mayor complejidad.

### Presentacion del MVP
- Interfaz inicial en `CLI`.
- La salida debe parecer un expediente operativo: ciudad actual, tiempo restante, pistas relevantes y acciones disponibles.
- La futura web puede reinterpretar la presentacion, pero no modificar reglas.

## Implicaciones
- El juego necesita explicar por que una pista existe y como afecta la deduccion.
- La dificultad debe ser testeable; no puede depender de improvisacion manual.
- El modelo de `Warrant` es central: evita que el juego sea solo "seguir flechas".

## Fuera de alcance
- Combate, sigilo tactico o minijuegos de accion.
- Arboles de dialogo complejos.
- Economia, inventario y crafting.
- Campana cinematica lineal.

## Concepto de ingenieria
Un `GDD` bien delimitado fija reglas observables del sistema. Para ingenieria, esto se traduce en invariantes y contratos de casos de uso; para diseno, en loops y estados de jugador. La clave es que ambos hablen del mismo comportamiento, no de artefactos separados.
