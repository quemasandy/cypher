Original prompt: contniue sin parar todo el roadmap hasta que tengas la version web finalizada

- Slice actual: cierre de la version web local-first final del roadmap.
- Decisiones iniciales:
  - mover la logica de presentacion relevante a `apps/web/src/web-case-presentation.ts` para poder probar progreso, CTA y reportes sin depender del DOM;
  - mantener la frontera hexagonal intacta: la web final mejora briefing, operabilidad y exporte, pero sigue consumiendo exactamente los mismos casos de uso;
  - considerar cerrada la web dentro del alcance actual cuando fuera jugable, durable, exportable y desplegable, sin abrir todavia `apps/api` ni persistencia remota compartida.
- Estado:
  - `apps/web/src/app.ts` ya renderiza la UI final del dossier con progreso visible, accion recomendada, exporte de reporte, fullscreen y feedback persistible;
  - `apps/web/src/web-case-presentation.ts` ya concentra la logica pura de progreso, recomendacion y reporte textual;
  - `apps/web/src/styles.css` ya incluye la capa visual definitiva del adapter web local-first;
  - `tests/web/web-case-presentation.test.ts` ya cubre la logica pura del adapter y `tests/web/web-server-smoke.test.ts` vigila los assets de la UI final servidos por HTTP;
  - `README.md`, `docs/roadmap.md`, `docs/architecture/overview.md`, `docs/architecture/testing-strategy.md` y `docs/development/incremental-web-deployment.md` ya reflejan que la web local queda cerrada en este roadmap.
- Verificacion:
  - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm run build` pasa;
  - `PATH=/Users/andy/.nvm/versions/node/v20.19.6/bin:$PATH npm test` pasa con `47/47`.

- Implementacion ya agregada:
  - exporte del dossier actual como texto copiable o descargable;
  - barra de progreso y recomendacion del siguiente paso sincronizadas con la misma logica pura;
  - soporte de `fullscreen`, seed de demo, seed fresca y banner de feedback para una demo web mas completa;
  - pruebas puras del adapter web para blindar presentacion y reporte sin depender del navegador.
