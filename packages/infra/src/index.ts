/**
 * Este archivo expone la API publica de la capa de infraestructura inicial.
 * Los adapters concretos quedan agrupados aqui para que la CLI y los tests
 * no importen archivos internos sin necesidad.
 */
export { InMemoryCaseRepository } from "./in-memory-case-repository.js";
export { LocalStorageCaseRepository } from "./local-storage-case-repository.js";
export type { BrowserKeyValueStore } from "./browser-key-value-store.js";
export type { LocalStorageCaseRepositoryOptions } from "./local-storage-case-repository.js";
export { DEFAULT_LOCAL_STORAGE_CASE_KEY_PREFIX } from "./local-storage-case-repository.js";
export { SQLiteCaseRepository } from "./sqlite-case-repository.js";
export { CompositeTelemetry } from "./composite-telemetry.js";
export type { CompositeTelemetryOptions } from "./composite-telemetry.js";
export {
  DEMO_CASE_SEED,
  InMemoryEventBus,
  InMemoryTelemetry,
  createDemoBriefingCase
} from "./in-memory-support.js";
export type { TelemetryEntry } from "./in-memory-support.js";
export { StructuredFileTelemetry } from "./structured-file-telemetry.js";
export type {
  StructuredFileTelemetryOptions,
  StructuredTelemetryRecord
} from "./structured-file-telemetry.js";
export {
  DeterministicRandomnessProvider,
  createStableSeedToken
} from "./deterministic-randomness-provider.js";
export { ProceduralCaseGenerator } from "./procedural-case-generator.js";
