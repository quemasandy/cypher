# Local Environment Notes

## Proposito
Guardar observaciones concretas del entorno local usadas durante el desarrollo de `Cipher`. Este documento no define arquitectura ni producto; sirve para evitar perder contexto operativo entre sesiones.

## Runtime observado
- Fecha de observacion: `2026-04-04`
- `which npm`: `/usr/local/bin/npm`
- `which node`: `/usr/local/bin/node`
- `node -v`: `v14.15.4`
- `npm -v`: `6.14.10`

## Implicaciones
- El repositorio declara `node >= 20.0.0` en `package.json`.
- Con el runtime observado arriba, `tsc -b` compila, pero `npm test` y `npm run demo` fallan por features de Node modernas como `node --test` y `node:readline/promises`.
- Si una futura sesion vuelve a encontrar estos mismos binarios, conviene revisar primero la version activa de Node antes de diagnosticar fallos del proyecto.
