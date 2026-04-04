/**
 * Este archivo prueba el caso de uso `TravelToCity`.
 * Su rol es verificar que la capa de aplicacion coordina correctamente
 * persistencia, eventos, telemetria y la vista resultante del aggregate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { TravelToCity } from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("TravelToCity persists the trip, publishes domain events and records telemetry", async () => {
  // Creamos el aggregate que servira como caso semilla del test.
  const caseRecord = createBriefingCaseFixture();

  // El caso de uso requiere que el caso ya este abierto para investigar.
  caseRecord.start();

  // Limpiamos el evento de apertura para verificar solo el efecto del viaje.
  caseRecord.pullDomainEvents();

  // Construimos los adapters `in-memory` del escenario.
  const caseRepository = new InMemoryCaseRepository([caseRecord]);
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  // Construimos el caso de uso con sus puertos.
  const travelToCity = new TravelToCity({
    caseRepository,
    eventBus,
    telemetry
  });

  // Ejecutamos un viaje valido hacia la ciudad conectada desde el nodo inicial.
  const caseStatusView = await travelToCity.execute({
    caseId: caseRecord.id.value,
    destinationCityId: "santiago"
  });

  // Volvemos a leer el aggregate persistido para validar el efecto completo.
  const persistedCase = await caseRepository.getById(caseRecord.id.value);

  // Confirmamos que el aggregate fue guardado con la nueva ciudad actual.
  assert.ok(persistedCase);
  assert.equal(persistedCase.currentCityId, "santiago");
  assert.equal(persistedCase.remainingTime.value, 42);

  // Confirmamos que la vista de aplicacion ya revele el nuevo contexto geografico.
  assert.equal(caseStatusView.currentCityName, "Santiago");
  assert.equal(caseStatusView.travelHistory.length, 1);
  assert.equal(caseStatusView.travelHistory[0].toCityName, "Santiago");

  // Confirmamos que la aplicacion publique el evento emitido por el aggregate.
  assert.deepEqual(
    eventBus.publishedEvents.map((domainEvent: { type: string }) => domainEvent.type),
    ["CityTraveled"]
  );

  // Confirmamos que la accion deje una huella tecnica de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
  assert.equal(telemetry.recordedEntries[0].eventName, "city_traveled");
});
