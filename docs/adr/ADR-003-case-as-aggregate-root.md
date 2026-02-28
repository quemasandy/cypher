# ADR-003: Usar Case como aggregate root

## Estado
Aprobado

## Proposito
Registrar por que `Case` es el borde de consistencia principal del juego.

## Decisiones
### Contexto
Las operaciones relevantes del juego combinan tiempo, ciudad actual, pistas, warrant, estado del caso y resultado final. Si esos datos se distribuyen sin una raiz consistente, aparecen transiciones invalidas y coordinacion fragil.

### Decision
Modelar `Case` como `aggregate root` y exigir que:
- viajes,
- visitas,
- recoleccion de pistas,
- emision de warrant,
- y resolucion del caso
pasen por metodos o reglas coordinadas por `Case`.

### Alternativas consideradas
- `Agent` como raiz: centra la perspectiva del jugador, pero deja la investigacion fragmentada.
- `GameSession` mas amplia: agrega abstraccion que el MVP aun no necesita.
- Varias entidades independientes: reduce encapsulacion y complica invariantes.

## Implicaciones
- Las invariantes viven donde cambian los datos relevantes.
- Los repositories trabajan sobre `Case`.
- El modelo sigue siendo extensible si luego aparece una entidad superior como `Campaign`.

## Fuera de alcance
- Definir aun una jerarquia de meta-juego o campana.
- Convertir cada subcomponente del caso en aggregate separado.

## Concepto de ingenieria
El `aggregate root` es una decision de consistencia, no de jerarquia narrativa. Se elige segun donde deban validarse cambios atomicos e invariantes sin coordinacion externa compleja.
