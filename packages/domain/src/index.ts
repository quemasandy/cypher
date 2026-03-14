/**
 * Este archivo es la puerta de entrada publica del paquete de dominio.
 * Exporta solo los tipos y clases que otras capas necesitan conocer.
 */
export { Case } from "./case.js";
export type {
  AvailableLocationSnapshot,
  CaseDomainEvent,
  ClueCollectedDomainEvent,
  CaseOpenedDomainEvent,
  CaseProps,
  CaseResolution,
  CaseStatusSnapshot,
  CaseWarrant,
  BriefingCaseProps,
  LocationVisitedDomainEvent
} from "./case.js";
export { CaseState } from "./case-state.js";
export { DomainRuleViolationError } from "./domain-rule-violation-error.js";
export {
  Agent,
  Artifact,
  CaseId,
  Cipher,
  City,
  Location,
  Trait
} from "./supporting-types.js";
export type {
  AgentProps,
  ArtifactProps,
  CipherProps,
  CityProps,
  LocationClue,
  LocationProps,
  TraitProps
} from "./supporting-types.js";
export { TimeBudgetHours } from "./time-budget-hours.js";
