/**
 * Este archivo prueba el primer caso de uso real de la aplicacion.
 * Su valor es demostrar que la orquestacion entre dominio y puertos
 * funciona sin depender de una UI ni de persistencia real.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState } from "@cipher/domain";
import { StartCase } from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("StartCase persists the aggregate, publishes events and records telemetry", async () => {
  // Creamos el aggregate que funcionara como dato inicial de la prueba.
  const caseRecord = createBriefingCaseFixture();

  // Construimos los adapters `in-memory` del test.
  const caseRepository = new InMemoryCaseRepository([caseRecord]);
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  // Construimos el caso de uso con sus puertos.
  const startCase = new StartCase({
    caseRepository,
    eventBus,
    telemetry
  });

  // Ejecutamos el flujo principal del primer vertical.
  const caseStatusView = await startCase.execute({
    caseId: caseRecord.id.value
  });

  // Volvemos a leer el aggregate para verificar que quedo persistido.
  const persistedCase = await caseRepository.getById(caseRecord.id.value);

  // Confirmamos que el aggregate persistido quedo en el estado correcto.
  assert.ok(persistedCase);
  assert.equal(persistedCase.state, CaseState.INVESTIGATING);

  // Confirmamos que el caso de uso devolvio una vista consistente para adapters.
  assert.equal(caseStatusView.state, CaseState.INVESTIGATING);

  // Confirmamos que se publico el evento de dominio esperado.
  assert.equal(eventBus.publishedEvents.length, 1);

  // Confirmamos que tambien se registro una entrada de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
});
