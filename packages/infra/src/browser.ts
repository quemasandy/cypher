/**
 * Este archivo expone un entrypoint browser-safe para la capa de infraestructura.
 * Su objetivo es permitir adapters web locales sin arrastrar dependencias de Node
 * como `SQLiteCaseRepository` al navegador.
 */
export type { BrowserKeyValueStore } from "./browser-key-value-store.js";
export { CompositeTelemetry } from "./composite-telemetry.js";
export type { CompositeTelemetryOptions } from "./composite-telemetry.js";
export { InMemoryCaseRepository } from "./in-memory-case-repository.js";
export {
  DEFAULT_LOCAL_STORAGE_CASE_KEY_PREFIX,
  LocalStorageCaseRepository
} from "./local-storage-case-repository.js";
export {
  DEMO_CASE_SEED,
  InMemoryEventBus,
  InMemoryTelemetry,
  createDemoBriefingCase
} from "./in-memory-support.js";
export type { TelemetryEntry } from "./in-memory-support.js";
export {
  DeterministicRandomnessProvider,
  createStableSeedToken
} from "./deterministic-randomness-provider.js";
export { ProceduralCaseGenerator } from "./procedural-case-generator.js";
