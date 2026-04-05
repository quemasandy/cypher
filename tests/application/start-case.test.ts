/**
 * Este archivo prueba el primer caso de uso real de la aplicacion.
 * Su valor ahora es demostrar que la aplicacion puede crear un caso desde una `seed`,
 * persistirlo, publicar eventos y registrar telemetria sin depender de una UI real.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState } from "@cipher/domain";
import { StartCase } from "@cipher/application";
import {
  ProceduralCaseGenerator,
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";

test("StartCase generates a case from seed, persists it and records side effects", async () => {
  // Elegimos una `seed` fija para que el test sea totalmente reproducible.
  const seed = "acceptance-start-case";

  // Construimos los adapters `in-memory` del test.
  const caseRepository = new InMemoryCaseRepository();
  const caseGenerator = new ProceduralCaseGenerator();
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  // Construimos el caso de uso con sus puertos.
  const startCase = new StartCase({
    caseGenerator,
    caseRepository,
    eventBus,
    telemetry
  });

  // Ejecutamos el flujo de inicio usando la `seed` como entrada.
  const caseStatusView = await startCase.execute({
    seed
  });

  // Volvemos a leer el aggregate para verificar que quedo persistido.
  const persistedCase = await caseRepository.getById(caseStatusView.caseId);

  // Confirmamos que el aggregate persistido quedo en el estado correcto.
  assert.ok(persistedCase);
  assert.equal(persistedCase.state, CaseState.INVESTIGATING);

  // Confirmamos que el caso de uso devolvio una vista consistente para adapters.
  assert.equal(caseStatusView.state, CaseState.INVESTIGATING);
  assert.equal(caseStatusView.caseId, persistedCase.id.value);

  // Confirmamos que se publico el evento de dominio esperado.
  assert.equal(eventBus.publishedEvents.length, 1);

  // Confirmamos que tambien se registro una entrada de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
  assert.equal(telemetry.recordedEntries[0].payload.seed, seed);
});
