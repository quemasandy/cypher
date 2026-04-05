/**
 * Este archivo prueba que la aplicacion puede continuar un caso usando `SQLiteCaseRepository`.
 * Su rol didactico es mostrar que cambiar el adapter de persistencia no obliga a reescribir
 * casos de uso ni a tocar el dominio.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GetCaseStatus, StartCase, VisitLocation } from "@cipher/application";
import {
  InMemoryEventBus,
  InMemoryTelemetry,
  ProceduralCaseGenerator,
  SQLiteCaseRepository
} from "@cipher/infra";

test("SQLiteCaseRepository lets a case continue across repository instances", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-sqlite-application-"));
  const databaseFilePath = join(temporaryDirectoryPath, "cases.sqlite");

  try {
    // Primera sesion: creamos el caso desde una seed reproducible.
    const firstRepository = new SQLiteCaseRepository({
      databaseFilePath
    });
    const startCase = new StartCase({
      caseGenerator: new ProceduralCaseGenerator(),
      caseRepository: firstRepository,
      eventBus: new InMemoryEventBus(),
      telemetry: new InMemoryTelemetry()
    });
    const openedCaseStatusView = await startCase.execute({
      seed: "sqlite-case-continuation"
    });
    await firstRepository.close();

    // Segunda sesion: reabrimos el repo y ejecutamos una mutacion real sobre el aggregate rehidratado.
    const secondRepository = new SQLiteCaseRepository({
      databaseFilePath
    });
    const visitLocation = new VisitLocation({
      caseRepository: secondRepository,
      eventBus: new InMemoryEventBus(),
      telemetry: new InMemoryTelemetry()
    });
    const visitedCaseStatusView = await visitLocation.execute({
      caseId: openedCaseStatusView.caseId,
      locationId: openedCaseStatusView.availableLocations[0].id
    });
    await secondRepository.close();

    // Tercera sesion: leemos el caso sin mutarlo para confirmar que el estado visitado quedo persistido.
    const thirdRepository = new SQLiteCaseRepository({
      databaseFilePath
    });
    const getCaseStatus = new GetCaseStatus({
      caseRepository: thirdRepository
    });
    const reloadedCaseStatusView = await getCaseStatus.execute({
      caseId: openedCaseStatusView.caseId
    });

    assert.deepEqual(reloadedCaseStatusView, visitedCaseStatusView);
    assert.equal(
      reloadedCaseStatusView.availableLocations.filter((location) => location.isVisited).length,
      1
    );

    await thirdRepository.close();
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
});
