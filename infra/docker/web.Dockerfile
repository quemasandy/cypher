# Este archivo define el runtime containerizado minimo del adapter web.
# Su rol en la arquitectura es empaquetar el bundle portable ya generado por el repo
# dentro de una imagen Node simple, manteniendo al server como proceso unico y stateless.
FROM node:20-alpine

# Fijamos un directorio de trabajo pequeno y estable para el artefacto desplegable.
WORKDIR /app

# Dejamos valores por defecto compatibles con ejecucion local y plataformas tipo container service.
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

# Copiamos solo el bundle ya preparado, no el monorepo completo.
COPY . .

# Documentamos el puerto visible del adapter web para desarrollo y demos.
EXPOSE 4173

# El health check consulta el mismo endpoint operativo que el server publica para el exterior.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4173') + '/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

# Ejecutamos directamente el server compilado dentro del bundle.
CMD ["node", "apps/web/dist/server.js"]
