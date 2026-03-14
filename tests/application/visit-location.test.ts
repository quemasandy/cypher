/**
 * Este archivo prueba el caso de uso `VisitLocation`.
 * Su rol es verificar que la capa de aplicacion coordina correctamente
 * persistencia, eventos, telemetria y la vista resultante del aggregate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { VisitLocation } from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("VisitLocation persists the visit, publishes domain events and records telemetry", async () => {
  // Creamos el aggregate que servira como caso semilla del test.
  const caseRecord = createBriefingCaseFixture();

  // El caso de uso requiere que el caso ya este abierto para investigar.
  caseRecord.start();

  // Limpiamos el evento de apertura para verificar solo el efecto de la visita.
  caseRecord.pullDomainEvents();

  // Construimos los adapters `in-memory` del escenario.
  const caseRepository = new InMemoryCaseRepository([caseRecord]);
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  // Construimos el caso de uso con sus puertos.
  const visitLocation = new VisitLocation({
    caseRepository,
    eventBus,
    telemetry
  });

  // Ejecutamos la visita a la unica locacion del fixture.
  const caseStatusView = await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "harbor-warehouse"
  });

  // Volvemos a leer el aggregate persistido para validar el efecto completo.
  const persistedCase = await caseRepository.getById(caseRecord.id.value);

  // Confirmamos que el aggregate fue guardado con menos tiempo disponible.
  assert.ok(persistedCase);
  assert.equal(persistedCase.remainingTime.value, 44);

  // Confirmamos que la vista de aplicacion ya revele la pista recolectada.
  assert.equal(
    caseStatusView.availableLocations[0].clueSummary,
    "Shipping crates point to a fast maritime transfer."
  );

  // Confirmamos que la aplicacion publique los eventos emitidos por el aggregate.
  assert.deepEqual(
    eventBus.publishedEvents.map((domainEvent: { type: string }) => domainEvent.type),
    ["LocationVisited", "ClueCollected"]
  );

  // Confirmamos que la accion deje una huella tecnica de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
  assert.equal(telemetry.recordedEntries[0].eventName, "location_visited");
});
