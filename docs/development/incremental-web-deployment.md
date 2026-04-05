# Incremental Web Deployment

## Proposito
Documentar el camino de despliegue incremental del adapter web actual. Este documento no define una plataforma cloud concreta; fija la unidad minima desplegable que hoy tiene sentido para `Cipher` sin abandonar el enfoque `local-first`.

## Decisiones
### Unidad desplegable actual
- El primer despliegue publicable de `Cipher` es `apps/web` como un proceso Node unico.
- Ese proceso solo sirve `HTML`, `CSS`, `JS` compilado y paquetes browser-safe del monorepo.
- El estado del caso sigue viviendo en `localStorage` del navegador, no en el servidor.
- El artefacto recomendado ya no es el repo completo, sino el bundle generado en `.deploy/web/`.
- La experiencia entregada por ese bundle ya corresponde a la version web final del roadmap actual: dossier guiado, progreso visible y reporte local exportable.

### Operabilidad basica incluida
- `GET /healthz` devuelve un JSON pequeno con estado `ok`, servicio, adapter y timestamp del server.
- El arranque del server y cada request completada se registran en stdout como JSON por linea.
- `PORT` permite elegir el puerto de escucha.
- `HOST` permite fijar el bind address cuando el entorno de despliegue lo necesita.
- `bundle-manifest.json` deja visible que caminos fueron empaquetados y cual es el entrypoint real del bundle.

### Motivo de esta forma
- Es la menor superficie operativa que permite exhibicion publica del adapter web.
- Mantiene intactos dominio, casos de uso y persistencia `local-first`.
- Evita introducir backend remoto, auth, colas o base de datos cloud antes de tener una necesidad real.

## Runbook minimo
1. Compilar el monorepo:
   - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run build`
2. Preparar el bundle portable:
   - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run web:bundle`
3. Levantar el server desde el bundle ya empaquetado:
   - `HOST=0.0.0.0 PORT=4173 PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run web:bundle:start`
4. Verificar salud operativa:
   - `curl http://127.0.0.1:4173/healthz`
5. Abrir la interfaz:
   - `http://localhost:4173`
6. Verificar la experiencia web final:
   - abrir un caso, confirmar que aparece la recomendacion de siguiente paso, copiar o descargar el reporte y recargar la pagina para comprobar rehidratacion desde `localStorage`

## Runbook de contenedor
1. Verificar que Docker Desktop o el daemon equivalente este levantado.
2. Construir la imagen desde el bundle:
   - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run web:container:build`
3. Ejecutar la imagen local:
   - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run web:container:run`
4. Verificar salud operativa:
   - `curl http://127.0.0.1:4173/healthz`

## Contenido del bundle
- `apps/web/dist/`: server y entrypoints JS compilados.
- `apps/web/src/index.html` y `apps/web/src/styles.css`: shell visual servida por el adapter.
- `packages/application/dist`, `packages/contracts/dist`, `packages/domain/dist` y `packages/infra/dist`: modulos browser-safe requeridos por el import map.
- `bundle-manifest.json`: evidencia didactica del contenido empaquetado.
- `Dockerfile` y `.dockerignore`: contexto containerizable derivado de `infra/docker/`.

## Implicaciones
- El server web actual es stateless: reiniciarlo no borra progreso ya persistido en el browser del jugador.
- Un despliegue remoto de esta fase sirve para demo y portfolio, no para sincronizacion multi-dispositivo.
- La observabilidad inicial vive en stdout y en el endpoint de salud, lo que facilita correr el adapter en cualquier entorno sencillo.
- El bundle reduce el riesgo de depender accidentalmente de archivos del repo que no forman parte del runtime real.
- La opcion containerizada agrega un target generico de despliegue sin obligar a elegir un proveedor cloud especifico.
- El despliegue actual ya exhibe la experiencia web completa del roadmap sin agregar backend ni estado compartido de servidor.

## Fuera de alcance
- Proveedor cloud especifico.
- Contenedores, reverse proxy o IaC detallada.
- Persistencia remota compartida entre jugadores.
- Autenticacion, sesiones de servidor o multi-tenant.

## Concepto de ingenieria
Desplegar incrementalmente no significa empujar todo a cloud. Significa elegir la pieza mas pequena que ya entrega valor operativo real. En `Cipher`, esa pieza hoy es un server estatico con health check y logs estructurados, mientras la experiencia de juego sigue siendo `local-first`.
