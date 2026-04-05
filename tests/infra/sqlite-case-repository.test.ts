/**
 * Este archivo prueba el adapter `SQLiteCaseRepository` directamente.
 * Su objetivo es demostrar que un aggregate complejo puede persistirse y
 * rehidratarse sin perder estado semantico ni depender de repositorios `in-memory`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Warrant } from "@cipher/domain";
import { SQLiteCaseRepository } from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("SQLiteCaseRepository round-trips a resolved aggregate through a real sqlite file", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-sqlite-repository-"));
  const databaseFilePath = join(temporaryDirectoryPath, "cases.sqlite");

  try {
    // Preparamos un aggregate con bastante historia para cubrir mas campos del snapshot.
    const originalCaseRecord = createBriefingCaseFixture();
    originalCaseRecord.start();
    originalCaseRecord.visitLocation("harbor-warehouse");
    originalCaseRecord.visitLocation("rail-office");
    originalCaseRecord.travelToCity("santiago");
    originalCaseRecord.visitLocation("observatory-platform");
    originalCaseRecord.visitLocation("night-train-yard");
    originalCaseRecord.submitWarrant(
      new Warrant({
        suspectedTraits: [...originalCaseRecord.target.traits]
      })
    );
    originalCaseRecord.attemptArrest();

    const expectedCaseStatusSnapshot = originalCaseRecord.toStatusSnapshot();

    // Persistimos el aggregate en un archivo sqlite real y cerramos la primera instancia.
    const firstRepository = new SQLiteCaseRepository({
      databaseFilePath
    });
    await firstRepository.save(originalCaseRecord);
    await firstRepository.close();

    // Confirmamos que el adapter realmente escribio bytes a disco.
    const persistedDatabaseFileBuffer = await readFile(databaseFilePath);
    assert.ok(persistedDatabaseFileBuffer.byteLength > 0);

    // Abrimos otra instancia del adapter para simular un nuevo proceso o nueva sesion.
    const secondRepository = new SQLiteCaseRepository({
      databaseFilePath
    });
    const rehydratedCaseRecord = await secondRepository.getById(originalCaseRecord.id.value);

    assert.ok(rehydratedCaseRecord);
    assert.deepEqual(rehydratedCaseRecord.toStatusSnapshot(), expectedCaseStatusSnapshot);

    // La rehidratacion no debe inventar eventos nuevos; solo devuelve el estado persistido.
    assert.deepEqual(rehydratedCaseRecord.pullDomainEvents(), []);

    await secondRepository.close();
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
});
