/**
 * Este archivo es la puerta de entrada publica del paquete de dominio.
 * Exporta solo los tipos y clases que otras capas necesitan conocer.
 */
export { Case } from "./case.js";
export type {
  AvailableLocationSnapshot,
  AvailableTravelDestinationSnapshot,
  CaseDomainEvent,
  ClueCollectedDomainEvent,
  CaseOpenedDomainEvent,
  CaseProps,
  CaseResolution,
  CaseStatusSnapshot,
  CaseWarrant,
  BriefingCaseProps,
  CityTraveledDomainEvent,
  LocationVisitedDomainEvent,
  TravelHistoryEntry,
  TravelHistorySnapshot
} from "./case.js";
export { CaseState } from "./case-state.js";
export { DomainRuleViolationError } from "./domain-rule-violation-error.js";
export {
  Agent,
  Artifact,
  CaseId,
  Cipher,
  CityConnection,
  City,
  Location,
  Trait
} from "./supporting-types.js";
export type {
  AgentProps,
  ArtifactProps,
  CipherProps,
  CityConnectionProps,
  CityProps,
  LocationClue,
  LocationProps,
  TraitProps
} from "./supporting-types.js";
export { TimeBudgetHours } from "./time-budget-hours.js";
