# ADR-002: Adoptar estrategia CLI-first para el MVP

## Estado
Aprobado

## Proposito
Registrar por que el primer ejecutable de `Cipher` sera una interfaz de linea de comandos.

## Decisiones
### Contexto
El mayor riesgo inicial esta en el dominio, los casos de uso y la generacion procedural, no en la presentacion visual. Construir una web demasiado pronto puede desplazar esfuerzo hacia estado de UI, routing y detalles cosmeticos.

### Decision
Implementar primero un `CLI adapter` y postergar la web hasta que exista:
- un loop completo resoluble,
- una state machine estable,
- y una evolucion clara de persistencia.

### Alternativas consideradas
- `Web-first`: muestra mejor el proyecto, pero adelanta complejidad de interfaz.
- `Dual adapters` desde el inicio: mas demostrativo, pero duplica costo de integracion sin validar el nucleo.

## Implicaciones
- El MVP puede centrarse en informacion, comandos y trazabilidad.
- La arquitectura debe probar que la web futura sera un adapter adicional y no una reescritura.
- El CLI debe recibir suficiente cuidado UX para no distorsionar la evaluacion del juego.

## Fuera de alcance
- Renunciar a una UI web futura.
- Mantener el proyecto indefinidamente solo en terminal.

## Concepto de ingenieria
Elegir `CLI-first` es una estrategia de reduccion de riesgo. Permite validar comportamiento con menor costo de interfaz y produce evidencia mas clara sobre si el modelo del dominio ya esta listo para soportar otra superficie.
