/**
 * Este archivo implementa un repositorio `SQLite` local-first.
 * Su rol es demostrar que la aplicacion puede cambiar de `in-memory` a persistencia
 * real sin tocar casos de uso ni reglas del dominio.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { CaseRepository } from "@cipher/contracts";
import type { Case } from "@cipher/domain";
import {
  deserializeCaseRecord,
  serializeCaseRecord,
  type PersistedCaseSnapshot
} from "./case-record-serialization.js";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js") as typeof import("sql.js");

type SqlJsDatabase = import("sql.js").Database;
type SqlJsStatic = import("sql.js").SqlJsStatic;

const CREATE_CASES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS case_records (
    case_id TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL
  );
`;

const UPSERT_CASE_SQL = `
  INSERT INTO case_records (case_id, snapshot_json)
  VALUES ($caseId, $snapshotJson)
  ON CONFLICT(case_id) DO UPDATE SET snapshot_json = excluded.snapshot_json;
`;

const SELECT_CASE_BY_ID_SQL = `
  SELECT snapshot_json
  FROM case_records
  WHERE case_id = $caseId;
`;

export interface SQLiteCaseRepositoryProps {
  databaseFilePath: string;
}

export class SQLiteCaseRepository extends CaseRepository<Case> {
  private readonly databaseFilePath: string;
  private sqlJsPromise: Promise<SqlJsStatic> | null;
  private databasePromise: Promise<SqlJsDatabase> | null;

  /**
   * El constructor recibe la ruta del archivo `.sqlite` que actuara como almacenamiento local.
   */
  constructor({ databaseFilePath }: SQLiteCaseRepositoryProps) {
    super();

    if (typeof databaseFilePath !== "string" || databaseFilePath.trim().length === 0) {
      throw new Error("SQLiteCaseRepository requires a non-empty database file path.");
    }

    this.databaseFilePath = databaseFilePath.trim();
    this.sqlJsPromise = null;
    this.databasePromise = null;
  }

  /**
   * Este metodo busca el snapshot serializado y lo rehidrata como aggregate real.
   */
  async getById(caseId: string): Promise<Case | null> {
    const database = await this.getDatabase();
    const persistedSnapshotJson = this.selectSnapshotJsonByCaseId(database, caseId);

    if (persistedSnapshotJson === null) {
      return null;
    }

    return deserializeCaseRecord(
      JSON.parse(persistedSnapshotJson) as PersistedCaseSnapshot
    );
  }

  /**
   * Este metodo inserta o reemplaza el snapshot actual del aggregate.
   * Despues exporta la base completa a disco para mantener persistencia real entre procesos.
   */
  async save(caseRecord: Case): Promise<void> {
    const database = await this.getDatabase();
    const serializedCaseSnapshot = JSON.stringify(serializeCaseRecord(caseRecord));

    database.run(UPSERT_CASE_SQL, {
      $caseId: caseRecord.id.value,
      $snapshotJson: serializedCaseSnapshot
    });

    await this.flushDatabaseToDisk(database);
  }

  /**
   * Este helper libera la base cargada en memoria.
   * No forma parte del puerto, pero ayuda a tests o futuras herramientas de CLI.
   */
  async close(): Promise<void> {
    if (this.databasePromise === null) {
      return;
    }

    const database = await this.databasePromise;
    database.close();
    this.databasePromise = null;
  }

  private async getDatabase(): Promise<SqlJsDatabase> {
    if (this.databasePromise === null) {
      this.databasePromise = this.createDatabase();
    }

    return this.databasePromise;
  }

  private async getSqlJs(): Promise<SqlJsStatic> {
    if (this.sqlJsPromise === null) {
      this.sqlJsPromise = initSqlJs();
    }

    return this.sqlJsPromise;
  }

  /**
   * Este helper crea o abre el archivo SQLite y aplica el schema minimo requerido por el repo.
   */
  private async createDatabase(): Promise<SqlJsDatabase> {
    const SQL = await this.getSqlJs();
    const databaseFileBuffer = await this.readExistingDatabaseFile();
    const database = new SQL.Database(databaseFileBuffer);

    database.run(CREATE_CASES_TABLE_SQL);

    return database;
  }

  private async readExistingDatabaseFile(): Promise<Uint8Array | undefined> {
    await mkdir(dirname(this.databaseFilePath), { recursive: true });

    try {
      const databaseFileStats = await stat(this.databaseFilePath);

      if (databaseFileStats.size === 0) {
        return undefined;
      }

      const databaseFileBuffer = await readFile(this.databaseFilePath);
      return new Uint8Array(databaseFileBuffer);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  private selectSnapshotJsonByCaseId(
    database: SqlJsDatabase,
    caseId: string
  ): string | null {
    const queryResults = database.exec(SELECT_CASE_BY_ID_SQL, {
      $caseId: caseId
    });

    if (queryResults.length === 0 || queryResults[0].values.length === 0) {
      return null;
    }

    const snapshotJson = queryResults[0].values[0]?.[0];

    if (typeof snapshotJson !== "string") {
      throw new Error("SQLite case_records.snapshot_json must be stored as text.");
    }

    return snapshotJson;
  }

  private async flushDatabaseToDisk(database: SqlJsDatabase): Promise<void> {
    const exportedDatabaseBytes = database.export();
    await writeFile(this.databaseFilePath, Buffer.from(exportedDatabaseBytes));
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
