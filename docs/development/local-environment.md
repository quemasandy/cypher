# Local Environment Notes

## Proposito
Guardar observaciones concretas del entorno local usadas durante el desarrollo de `Cipher`. Este documento no define arquitectura ni producto; sirve para evitar perder contexto operativo entre sesiones.

## Runtime observado
- Fecha de observacion: `2026-04-04`
- `which npm`: `/usr/local/bin/npm`
- `which node`: `/usr/local/bin/node`
- `node -v`: `v14.15.4`
- `npm -v`: `6.14.10`
- `which -a node`: `/usr/local/bin/node`, `/Users/andy/.nvm/versions/node/v20.19.6/bin/node`
- `which -a npm`: `/usr/local/bin/npm`, `/Users/andy/.nvm/versions/node/v20.19.6/bin/npm`
- Runtime compatible encontrado: `/Users/andy/.nvm/versions/node/v20.19.6/bin/node`
- `node -v` con esa ruta explicita: `v20.19.6`
- `npm -v` con esa ruta explicita: `10.8.2`

## Implicaciones
- El repositorio declara `node >= 20.0.0` en `package.json`.
- La shell activa sigue resolviendo primero `/usr/local/bin/node` y `/usr/local/bin/npm`, por eso una sesion que use `node`/`npm` sin ajustar `PATH` puede caer otra vez en Node 14.
- El repo ahora incluye `.nvmrc` con `20.19.6` para que `nvm use` recupere el runtime esperado mas rapido.
- Para verificar el repo sin cambiar configuracion global, se puede anteponer esta ruta al `PATH`:
  - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH`
- Con ese `PATH`, `npm test` y `npm run demo` ya pueden ejecutarse normalmente.
- Si una futura sesion vuelve a encontrar estos mismos binarios, conviene revisar primero la version activa de Node antes de diagnosticar fallos del proyecto.
