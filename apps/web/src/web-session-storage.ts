/**
 * Este archivo persiste el cascaron de la sesion web.
 * Existe para guardar estado propio del adapter del browser, como el `caseId`
 * activo y la traza visible de eventos, sin contaminar el dominio con detalles de UI.
 */
import type { CaseDomainEvent } from "@cipher/domain";
import type {
  BrowserKeyValueStore,
  TelemetryEntry
} from "@cipher/infra/browser";

export interface PersistedWebSessionSnapshot {
  version: 1;
  seed: string;
  activeCaseId: string | null;
  selectedTraitCodes: string[];
  publishedEvents: CaseDomainEvent[];
  recordedTelemetryEntries: TelemetryEntry[];
}

export interface PersistedWebSessionStorageOptions {
  browserStorage: BrowserKeyValueStore;
  storageKey?: string;
}

export const DEFAULT_WEB_SESSION_STORAGE_KEY = "cipher:web:session";

export function loadPersistedWebSessionSnapshot({
  browserStorage,
  storageKey = DEFAULT_WEB_SESSION_STORAGE_KEY
}: PersistedWebSessionStorageOptions): PersistedWebSessionSnapshot | null {
  const rawPersistedSessionSnapshot = browserStorage.getItem(storageKey);

  if (rawPersistedSessionSnapshot === null) {
    return null;
  }

  let parsedPersistedSessionSnapshot: unknown;

  // Si el JSON esta corrupto, devolvemos `null` para que la app arranque limpia.
  try {
    parsedPersistedSessionSnapshot = JSON.parse(rawPersistedSessionSnapshot);
  } catch {
    return null;
  }

  return isPersistedWebSessionSnapshot(parsedPersistedSessionSnapshot)
    ? parsedPersistedSessionSnapshot
    : null;
}

export function savePersistedWebSessionSnapshot({
  browserStorage,
  storageKey = DEFAULT_WEB_SESSION_STORAGE_KEY,
  sessionSnapshot
}: PersistedWebSessionStorageOptions & {
  sessionSnapshot: PersistedWebSessionSnapshot;
}): void {
  const serializableSessionSnapshot: PersistedWebSessionSnapshot = {
    version: 1,
    seed: sessionSnapshot.seed,
    activeCaseId: sessionSnapshot.activeCaseId,
    selectedTraitCodes: [...sessionSnapshot.selectedTraitCodes],
    publishedEvents: sessionSnapshot.publishedEvents.map((publishedEvent) => ({
      ...publishedEvent
    })),
    recordedTelemetryEntries: sessionSnapshot.recordedTelemetryEntries.map(
      (telemetryEntry) => ({
        eventName: telemetryEntry.eventName,
        payload: { ...telemetryEntry.payload }
      })
    )
  };

  browserStorage.setItem(storageKey, JSON.stringify(serializableSessionSnapshot));
}

export function clearPersistedWebSessionSnapshot({
  browserStorage,
  storageKey = DEFAULT_WEB_SESSION_STORAGE_KEY
}: PersistedWebSessionStorageOptions): void {
  browserStorage.removeItem(storageKey);
}

function isPersistedWebSessionSnapshot(
  candidateValue: unknown
): candidateValue is PersistedWebSessionSnapshot {
  if (typeof candidateValue !== "object" || candidateValue === null) {
    return false;
  }

  if (!("version" in candidateValue) || candidateValue.version !== 1) {
    return false;
  }

  if (!("seed" in candidateValue) || typeof candidateValue.seed !== "string") {
    return false;
  }

  if (
    !("activeCaseId" in candidateValue) ||
    (candidateValue.activeCaseId !== null &&
      typeof candidateValue.activeCaseId !== "string")
  ) {
    return false;
  }

  if (
    !("selectedTraitCodes" in candidateValue) ||
    !Array.isArray(candidateValue.selectedTraitCodes) ||
    candidateValue.selectedTraitCodes.some(
      (traitCode) => typeof traitCode !== "string"
    )
  ) {
    return false;
  }

  if (
    !("publishedEvents" in candidateValue) ||
    !Array.isArray(candidateValue.publishedEvents)
  ) {
    return false;
  }

  if (
    !("recordedTelemetryEntries" in candidateValue) ||
    !Array.isArray(candidateValue.recordedTelemetryEntries)
  ) {
    return false;
  }

  return true;
}
