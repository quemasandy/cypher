# 📚 Roadmap de estudio para el proyecto **Cipher**

Este documento te guía paso a paso para comprender el proyecto desde los conceptos más críticos hasta los detalles más finos. Cada sección incluye *check‑points* que puedes marcar a medida que avances.

---

## ✅ 1️⃣ Fundamentos del dominio (Aggregate Root `Case`)
- [in progress] Leer `packages/domain/case/Case.ts` y entender la responsabilidad del aggregate root.
- [ ] Revisar los comentarios de cabecera que explican el propósito del archivo.
- [ ] Identificar los métodos públicos (`travelTo`, `collectClue`, `issueWarrant`, `arrest`, …) y cómo garantizan invariantes.
- [ ] Dibujar (a mano o en una herramienta) el diagrama de relaciones entre `Case` y sus sub‑entidades.

---

## ✅ 2️⃣ Casos de uso (Use‑cases) y capa de aplicación
- [ ] Explorar la carpeta `apps/cli/src/usecases/`.
- [ ] Para cada archivo de caso de uso, identificar los *ports* que se inyectan.
- [ ] Entender cómo cada caso de uso orquesta la lógica del aggregate.
- [ ] Ejecutar un caso de uso desde la línea de comandos (`npm run dev -- <comando>`) y observar el `CaseStatusSnapshot` resultante.

---

## ✅ 3️⃣ Infraestructura (Adapters) y agnosticidad
- [ ] Revisar `infra/persistence/` y `infra/terminal/`.
- [ ] Identificar la interfaz `CaseRepositoryPort` y sus implementaciones (`InMemoryCaseRepository`, `FileSystemCaseRepository`).
- [ ] Cambiar la configuración para usar la persistencia en archivo y validar que el caso se guarda y carga correctamente.
- [ ] Explicar con tus palabras qué significa que el dominio sea *agnóstico* respecto a la infraestructura.

---

## ✅ 4️⃣ Máquina de estado (`CaseState`)
- [ ] Leer `packages/domain/case/CaseState.ts`.
- [ ] Estudiar el diagrama de transición en `docs/architecture/state-machine.md`.
- [ ] Simular manualmente una secuencia de eventos (emitir orden → viajar → arrestar) y verificar que las transiciones son válidas.
- [ ] Añadir una prueba unitária que intente una transición inválida y confirme que se lanza `InvalidStateTransitionError`.

---

## ✅ 5️⃣ DTOs y snapshots (`CaseStatusSnapshot`)
- [ ] Abrir `packages/domain/case/CaseStatusSnapshot.ts`.
- [ ] Enumerar cada propiedad y describir su significado (ver tabla de referencia en la conversación anterior).
- [ ] Identificar los sub‑tipos (`IssuedWarrantSnapshot`, `AvailableLocationSnapshot`, etc.) y su relación con el aggregate.
- [ ] Implementar una función de utilidad que convierta un `Case` en su snapshot y probarla en la consola.

---

## ✅ 6️⃣ Entidades y value objects del dominio
- [ ] Revisar `packages/domain/entities/` (Agent, Agency, Target, City, Location, Clue, Club, Trade, Warrant).
- [ ] Para cada entidad, escribir una breve descripción de su rol en el juego.
- [ ] Diferenciar entre *entidades* (tienen `id`) y *value objects* (inmutables, sin identidad propia).
- [ ] Crear un mapa mental (puede ser un dibujo) que muestre cómo todas estas piezas se agrupan bajo `Case`.

---

## ✅ 7️⃣ Arquitectura de paquetes (`packages/`)
- [ ] Leer `docs/architecture/packages.md`.
- [ ] Entender la separación lógica: `domain`, `infra`, `apps`, `shared`.
- [ ] Explicar por qué el proyecto no usa paquetes NPM tradicionales para cada módulo.
- [ ] Proponer una posible reorganización si el proyecto creciera a gran escala.

---

## 🎯 Checklist final
- [ ] Tener una visión clara de cómo el aggregate root mantiene la consistencia del dominio.
- [ ] Poder describir cada caso de uso y su interacción con los ports.
- [ ] Saber cómo cambiar la infraestructura sin tocar la lógica de negocio.
- [ ] Entender y dibujar la máquina de estados completa.
- [ ] Utilizar los DTOs para presentar datos a la capa de presentación.
- [ ] Reconocer todas las entidades y value objects y su relación con `Case`.
- [ ] Comprender la organización de paquetes y su propósito.

---

> **Cómo usar este roadmap**
> 1. Abre el archivo en tu editor favorito.
> 2. Marca cada casilla `[ ]` con `[/]` cuando empieces a trabajar en ella y con `[x]` al completarla.
> 3. Añade notas al lado de cada punto si deseas registrar observaciones o preguntas.
> 4. Revisa periódicamente el progreso y ajusta el orden si descubres que algún tema necesita más profundidad.

¡Mucho éxito en tu aprendizaje! 🚀
