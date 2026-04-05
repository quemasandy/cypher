/**
 * Este archivo implementa un repositorio persistente para navegadores.
 * Su objetivo es demostrar que el mismo puerto `CaseRepository` puede vivir
 * sobre un storage local simple, manteniendo al dominio ajeno a `localStorage`.
 */
import { CaseRepository } from "@cipher/contracts";
import type { Case } from "@cipher/domain";
import {
  deserializeCaseRecord,
  serializeCaseRecord,
  type PersistedCaseSnapshot
} from "./case-record-serialization.js";
import type { BrowserKeyValueStore } from "./browser-key-value-store.js";

export interface LocalStorageCaseRepositoryOptions {
  browserStorage: BrowserKeyValueStore;
  storageKeyPrefix?: string;
}

export const DEFAULT_LOCAL_STORAGE_CASE_KEY_PREFIX = "cipher:web:case-record:";

export class LocalStorageCaseRepository extends CaseRepository<Case> {
  private readonly browserStorage: BrowserKeyValueStore;
  private readonly storageKeyPrefix: string;

  /**
   * El constructor recibe el storage concreto para que este adapter siga siendo
   * testeable en Node y reutilizable con cualquier implementacion compatible.
   */
  constructor({
    browserStorage,
    storageKeyPrefix = DEFAULT_LOCAL_STORAGE_CASE_KEY_PREFIX
  }: LocalStorageCaseRepositoryOptions) {
    super();
    this.browserStorage = browserStorage;
    this.storageKeyPrefix = storageKeyPrefix;
  }

  /**
   * Este metodo lee el snapshot serializado y recompone el aggregate del dominio.
   */
  async getById(caseId: string): Promise<Case | null> {
    const storageKey = this.buildStorageKey(caseId);
    const rawPersistedCaseRecord = this.browserStorage.getItem(storageKey);

    if (rawPersistedCaseRecord === null) {
      return null;
    }

    let parsedPersistedCaseRecord: unknown;

    // Primero validamos que el contenido guardado siga siendo JSON valido.
    try {
      parsedPersistedCaseRecord = JSON.parse(rawPersistedCaseRecord);
    } catch (error: unknown) {
      throw new Error(
        `Stored browser case ${caseId} could not be parsed as JSON.`,
        { cause: error }
      );
    }

    // Luego rehidratamos el aggregate usando el mismo mapper que SQLite.
    try {
      return deserializeCaseRecord(
        parsedPersistedCaseRecord as PersistedCaseSnapshot
      );
    } catch (error: unknown) {
      throw new Error(
        `Stored browser case ${caseId} could not be rehydrated into a Case aggregate.`,
        { cause: error }
      );
    }
  }

  /**
   * Este metodo persiste el aggregate como JSON bajo una clave derivada del `caseId`.
   */
  async save(caseRecord: Case): Promise<void> {
    const storageKey = this.buildStorageKey(caseRecord.id.value);
    const persistedCaseSnapshot = serializeCaseRecord(caseRecord);

    this.browserStorage.setItem(storageKey, JSON.stringify(persistedCaseSnapshot));
  }

  /**
   * Este helper extra permite limpiar sesiones web sin dejar snapshots huerfanos.
   * No forma parte del puerto abstracto porque es una capacidad propia de este adapter.
   */
  async deleteById(caseId: string): Promise<void> {
    this.browserStorage.removeItem(this.buildStorageKey(caseId));
  }

  private buildStorageKey(caseId: string): string {
    return `${this.storageKeyPrefix}${caseId}`;
  }
}
