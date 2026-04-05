/**
 * Este archivo prueba el caso de uso `SubmitWarrant`.
 * Su rol es verificar que la capa de aplicacion coordina correctamente
 * persistencia, eventos, telemetria y la vista resultante del aggregate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState } from "@cipher/domain";
import { SubmitWarrant, VisitLocation } from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("SubmitWarrant persists the warrant, publishes domain events and records telemetry", async () => {
  // Creamos el aggregate que servira como caso semilla del test.
  const caseRecord = createBriefingCaseFixture();

  // El caso de uso requiere que el caso ya este abierto para investigar.
  caseRecord.start();

  // Limpiamos el evento de apertura para verificar solo el efecto de la warrant.
  caseRecord.pullDomainEvents();

  // Construimos los adapters `in-memory` del escenario.
  const caseRepository = new InMemoryCaseRepository([caseRecord]);
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  // Construimos el caso de uso con sus puertos.
  const submitWarrant = new SubmitWarrant({
    caseRepository,
    eventBus,
    telemetry
  });

  const visitLocation = new VisitLocation({
    caseRepository,
    eventBus,
    telemetry
  });

  // Descubrimos primero una ruta viable y el rasgo que luego usaremos para respaldar la warrant.
  await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "harbor-warehouse"
  });

  await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "rail-office"
  });

  // Limpiamos los side effects anteriores para observar solo la emision de la warrant.
  eventBus.publishedEvents.length = 0;
  telemetry.recordedEntries.length = 0;

  // Ejecutamos la emision de una warrant valida.
  const caseStatusView = await submitWarrant.execute({
    caseId: caseRecord.id.value,
    suspectedTraits: [
      {
        code: "travels-light",
        label: "Travels light"
      }
    ]
  });

  // Volvemos a leer el aggregate persistido para validar el efecto completo.
  const persistedCase = await caseRepository.getById(caseRecord.id.value);

  // Confirmamos que el aggregate fue guardado en el nuevo estado de la state machine.
  assert.ok(persistedCase);
  assert.equal(persistedCase.state, CaseState.WARRANT_ISSUED);
  assert.ok(persistedCase.warrant);

  // Confirmamos que la vista de aplicacion ya revele la orden emitida.
  assert.ok(caseStatusView.issuedWarrant);
  assert.equal(caseStatusView.issuedWarrant.suspectedTraits[0].label, "Travels light");

  // Confirmamos que la aplicacion publique el evento emitido por el aggregate.
  assert.deepEqual(
    eventBus.publishedEvents.map((domainEvent: { type: string }) => domainEvent.type),
    ["WarrantIssued"]
  );

  // Confirmamos que la accion deje una huella tecnica de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
  assert.equal(telemetry.recordedEntries[0].eventName, "warrant_submitted");
});
