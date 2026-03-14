/**
 * Este archivo expone la API publica de la capa de infraestructura inicial.
 * Los adapters concretos quedan agrupados aqui para que la CLI y los tests
 * no importen archivos internos sin necesidad.
 */
export { InMemoryCaseRepository } from "./in-memory-case-repository.js";
export {
  InMemoryEventBus,
  InMemoryTelemetry,
  createDemoBriefingCase
} from "./in-memory-support.js";
export type { TelemetryEntry } from "./in-memory-support.js";
