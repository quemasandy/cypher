---
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.mjs,**/*.cjs,**/*.py,**/*.go,**/*.rs,**/*.java,**/*.kt,**/*.rb,**/*.php,**/*.cs,**/*.swift,**/*.sh"
---

# Instrucciones didacticas para codigo fuente

Este proyecto se usa para aprender. Al escribir o editar codigo:

- Empieza cada archivo nuevo con un comentario de cabecera que explique que hace el archivo, por que existe y en que capa de la arquitectura vive.
- Usa nombres claros y flujo explicito antes que abreviaturas o trucos.
- Comenta cada paso no trivial cerca del codigo.
- Si varias lineas juntas representan un solo paso mental, usa un comentario corto antes del bloque en lugar de comentarios redundantes linea por linea.
- Si tocas dominio, puertos, adaptadores o contratos, mantén la separacion de capas y deja claro el motivo en comentarios o en la explicacion de la respuesta.
- Cuando modifiques codigo existente, preserva y mejora la explicabilidad del archivo.
