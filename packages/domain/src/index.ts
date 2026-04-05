/**
 * Este archivo es la puerta de entrada publica del paquete de dominio.
 * Exporta solo los tipos y clases que otras capas necesitan conocer.
 */
export { Case } from "./case.js";
export type {
  AvailableLocationSnapshot,
  AvailableTravelDestinationSnapshot,
  CaseDomainEvent,
  CaseResolution,
  CaseResolutionCause,
  CaseResolutionOutcome,
  CaseResolutionSnapshot,
  ClueCollectedDomainEvent,
  CaseOpenedDomainEvent,
  CaseProps,
  CaseStatusSnapshot,
  CaseWarrant,
  BriefingCaseProps,
  CityTraveledDomainEvent,
  CipherEscapedDomainEvent,
  EscapeResolutionCause,
  IssuedWarrantSnapshot,
  LocationVisitedDomainEvent,
  TraitSnapshot,
  TravelHistoryEntry,
  TravelHistorySnapshot,
  CaseResolvedDomainEvent,
  WarrantIssuedDomainEvent
} from "./case.js";
export {
  CaseResolutionCause as CaseResolutionCauseValues,
  CaseResolutionOutcome as CaseResolutionOutcomeValues
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
  Trait,
  Warrant
} from "./supporting-types.js";
export type {
  AgentProps,
  ArtifactProps,
  CipherProps,
  CityConnectionProps,
  CityProps,
  LocationClue,
  LocationProps,
  TraitProps,
  WarrantProps
} from "./supporting-types.js";
export { TimeBudgetHours } from "./time-budget-hours.js";
