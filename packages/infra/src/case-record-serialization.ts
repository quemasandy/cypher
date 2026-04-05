/**
 * Este archivo define la traduccion entre el aggregate `Case` y un snapshot plano.
 * Vive en infraestructura porque su objetivo es persistir y reconstruir estado para
 * adapters concretos, pero el formato sigue siendo agnostico al motor de storage.
 */
import {
  Agent,
  Artifact,
  Case,
  CaseId,
  CaseState,
  Cipher,
  City,
  CityConnection,
  Location,
  TimeBudgetHours,
  Trait,
  Warrant,
  type AgentProps,
  type ArtifactProps,
  type CaseResolution,
  type CaseResolutionSnapshot,
  type CipherProps,
  type LocationClue,
  type TraitProps,
  type TravelHistoryEntry
} from "@cipher/domain";

interface PersistedTraitSnapshot extends TraitProps {}

interface PersistedWarrantSnapshot {
  suspectedTraits: PersistedTraitSnapshot[];
}

interface PersistedCipherSnapshot extends Omit<CipherProps, "traits"> {
  traits: PersistedTraitSnapshot[];
}

interface PersistedLocationClueSnapshot {
  type: string;
  summary: string;
  revealedTrait?: PersistedTraitSnapshot;
  revealedDestinationCityId?: string;
}

interface PersistedLocationSnapshot {
  id: string;
  name: string;
  clue: PersistedLocationClueSnapshot;
}

interface PersistedCityConnectionSnapshot {
  destinationCityId: string;
  travelTimeHours: number;
}

interface PersistedCitySnapshot {
  id: string;
  name: string;
  locations: PersistedLocationSnapshot[];
  connections: PersistedCityConnectionSnapshot[];
}

export interface PersistedCaseSnapshot {
  id: string;
  state: CaseState;
  activeAgent: AgentProps;
  target: PersistedCipherSnapshot;
  artifact: ArtifactProps;
  cities: PersistedCitySnapshot[];
  currentCityId: string;
  finalCityId: string;
  remainingTimeHours: number;
  travelHistory: TravelHistoryEntry[];
  visitedLocationIds: string[];
  collectedClues: string[];
  warrant: PersistedWarrantSnapshot | null;
  resolution: CaseResolutionSnapshot | null;
}

/**
 * Este helper convierte un aggregate vivo en un objeto JSON-safe.
 * La idea es guardar solo datos serializables y reconstruir las clases del dominio al leer.
 */
export function serializeCaseRecord(caseRecord: Case): PersistedCaseSnapshot {
  return {
    id: caseRecord.id.value,
    state: caseRecord.state,
    activeAgent: {
      id: caseRecord.activeAgent.id,
      name: caseRecord.activeAgent.name,
      agency: caseRecord.activeAgent.agency
    },
    target: {
      alias: caseRecord.target.alias,
      traits: caseRecord.target.traits.map(serializeTrait)
    },
    artifact: {
      id: caseRecord.artifact.id,
      name: caseRecord.artifact.name,
      historicalOrigin: caseRecord.artifact.historicalOrigin
    },
    cities: caseRecord.cities.map((city) => ({
      id: city.id,
      name: city.name,
      locations: city.locations.map((location) => ({
        id: location.id,
        name: location.name,
        clue: serializeLocationClue(location.clue)
      })),
      connections: city.connections.map((connection) => ({
        destinationCityId: connection.destinationCityId,
        travelTimeHours: connection.travelTimeHours
      }))
    })),
    currentCityId: caseRecord.currentCityId,
    finalCityId: caseRecord.finalCityId,
    remainingTimeHours: caseRecord.remainingTime.value,
    travelHistory: caseRecord.travelHistory.map((travelEntry) => ({ ...travelEntry })),
    visitedLocationIds: [...caseRecord.visitedLocationIds],
    collectedClues: [...caseRecord.collectedClues],
    warrant:
      caseRecord.warrant === null
        ? null
        : {
            suspectedTraits: caseRecord.warrant.suspectedTraits.map(serializeTrait)
          },
    resolution: caseRecord.resolution === null ? null : { ...caseRecord.resolution }
  };
}

/**
 * Este helper recorre el camino inverso: toma datos persistidos y recompone clases del dominio.
 * Asi el resto del sistema sigue trabajando con aggregates reales, no con objetos planos.
 */
export function deserializeCaseRecord(
  persistedCaseSnapshot: PersistedCaseSnapshot
): Case {
  assertIsPersistedCaseSnapshot(persistedCaseSnapshot);

  const activeAgent = new Agent(persistedCaseSnapshot.activeAgent);
  const target = new Cipher({
    alias: persistedCaseSnapshot.target.alias,
    traits: persistedCaseSnapshot.target.traits.map(deserializeTrait)
  });
  const artifact = new Artifact(persistedCaseSnapshot.artifact);
  const cities = persistedCaseSnapshot.cities.map(deserializeCity);
  const warrant =
    persistedCaseSnapshot.warrant === null
      ? null
      : new Warrant({
          suspectedTraits: persistedCaseSnapshot.warrant.suspectedTraits.map(deserializeTrait)
        });
  const resolution = deserializeResolution(persistedCaseSnapshot.resolution);

  return new Case({
    id: new CaseId(persistedCaseSnapshot.id),
    state: persistedCaseSnapshot.state,
    activeAgent,
    target,
    artifact,
    cities,
    currentCityId: persistedCaseSnapshot.currentCityId,
    finalCityId: persistedCaseSnapshot.finalCityId,
    remainingTime: TimeBudgetHours.fromNumber(persistedCaseSnapshot.remainingTimeHours),
    travelHistory: persistedCaseSnapshot.travelHistory.map((travelEntry) => ({ ...travelEntry })),
    visitedLocationIds: [...persistedCaseSnapshot.visitedLocationIds],
    collectedClues: [...persistedCaseSnapshot.collectedClues],
    warrant,
    resolution
  });
}

function serializeTrait(trait: Trait): PersistedTraitSnapshot {
  return {
    code: trait.code,
    label: trait.label
  };
}

function deserializeTrait(persistedTraitSnapshot: PersistedTraitSnapshot): Trait {
  return new Trait(persistedTraitSnapshot);
}

function serializeLocationClue(locationClue: LocationClue): PersistedLocationClueSnapshot {
  return {
    type: locationClue.type,
    summary: locationClue.summary,
    ...(locationClue.revealedTrait === undefined
      ? {}
      : { revealedTrait: serializeTrait(locationClue.revealedTrait) }),
    ...(locationClue.revealedDestinationCityId === undefined
      ? {}
      : { revealedDestinationCityId: locationClue.revealedDestinationCityId })
  };
}

function deserializeLocationClue(
  persistedLocationClueSnapshot: PersistedLocationClueSnapshot
): LocationClue {
  return {
    type: persistedLocationClueSnapshot.type,
    summary: persistedLocationClueSnapshot.summary,
    ...(persistedLocationClueSnapshot.revealedTrait === undefined
      ? {}
      : { revealedTrait: deserializeTrait(persistedLocationClueSnapshot.revealedTrait) }),
    ...(persistedLocationClueSnapshot.revealedDestinationCityId === undefined
      ? {}
      : { revealedDestinationCityId: persistedLocationClueSnapshot.revealedDestinationCityId })
  };
}

function deserializeCity(persistedCitySnapshot: PersistedCitySnapshot): City {
  return new City({
    id: persistedCitySnapshot.id,
    name: persistedCitySnapshot.name,
    locations: persistedCitySnapshot.locations.map(
      (persistedLocationSnapshot) =>
        new Location({
          id: persistedLocationSnapshot.id,
          name: persistedLocationSnapshot.name,
          clue: deserializeLocationClue(persistedLocationSnapshot.clue)
        })
    ),
    connections: persistedCitySnapshot.connections.map(
      (persistedConnectionSnapshot) =>
        new CityConnection({
          destinationCityId: persistedConnectionSnapshot.destinationCityId,
          travelTimeHours: persistedConnectionSnapshot.travelTimeHours
        })
    )
  });
}

function deserializeResolution(
  persistedResolutionSnapshot: CaseResolutionSnapshot | null
): CaseResolution {
  return persistedResolutionSnapshot === null ? null : { ...persistedResolutionSnapshot };
}

/**
 * Este guard rail evita rehidratar basura opaca desde SQLite.
 * No reemplaza a las validaciones del dominio, pero vuelve mas legible un fallo de storage.
 */
function assertIsPersistedCaseSnapshot(
  persistedCaseSnapshot: unknown
): asserts persistedCaseSnapshot is PersistedCaseSnapshot {
  if (typeof persistedCaseSnapshot !== "object" || persistedCaseSnapshot === null) {
    throw new Error("Persisted case snapshot must be a non-null object.");
  }

  if (!("id" in persistedCaseSnapshot) || typeof persistedCaseSnapshot.id !== "string") {
    throw new Error("Persisted case snapshot must contain a string id.");
  }

  if (
    !("remainingTimeHours" in persistedCaseSnapshot) ||
    typeof persistedCaseSnapshot.remainingTimeHours !== "number"
  ) {
    throw new Error("Persisted case snapshot must contain numeric remaining time.");
  }

  if (!("cities" in persistedCaseSnapshot) || !Array.isArray(persistedCaseSnapshot.cities)) {
    throw new Error("Persisted case snapshot must contain a city collection.");
  }
}
