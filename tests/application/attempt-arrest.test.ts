/**
 * Este archivo prueba el caso de uso `AttemptArrest`.
 * Su rol es verificar que la capa de aplicacion coordina correctamente
 * persistencia, eventos, telemetria y la vista resultante del aggregate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState } from "@cipher/domain";
import {
  AttemptArrest,
  SubmitWarrant,
  TravelToCity,
  VisitLocation
} from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry
} from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("AttemptArrest persists a successful arrest, publishes resolution events and records telemetry", async () => {
  // Creamos el aggregate que servira como caso semilla del test.
  const caseRecord = createBriefingCaseFixture();

  // El escenario requiere abrir el caso, emitir warrant completa y llegar a la ciudad final.
  caseRecord.start();

  const caseRepository = new InMemoryCaseRepository([caseRecord]);
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

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

  const travelToCity = new TravelToCity({
    caseRepository,
    eventBus,
    telemetry
  });

  const attemptArrest = new AttemptArrest({
    caseRepository,
    eventBus,
    telemetry
  });

  // Descubrimos primero la ruta de salida y luego el primer rasgo en la ciudad inicial.
  await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "harbor-warehouse"
  });

  await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "rail-office"
  });

  // Viajamos a la ciudad final para descubrir el segundo rasgo requerido.
  await travelToCity.execute({
    caseId: caseRecord.id.value,
    destinationCityId: "santiago"
  });

  await visitLocation.execute({
    caseId: caseRecord.id.value,
    locationId: "night-train-yard"
  });

  // Emitimos una warrant que coincide con todos los rasgos ya descubiertos.
  await submitWarrant.execute({
    caseId: caseRecord.id.value,
    suspectedTraits: [
      {
        code: "travels-light",
        label: "Travels light"
      },
      {
        code: "prefers-night-trains",
        label: "Prefers night trains"
      }
    ]
  });

  // Limpiamos la observacion previa para aislar el efecto del arresto.
  eventBus.publishedEvents.length = 0;
  telemetry.recordedEntries.length = 0;

  // Ejecutamos el arresto final.
  const caseStatusView = await attemptArrest.execute({
    caseId: caseRecord.id.value
  });

  // Volvemos a leer el aggregate persistido para validar el efecto completo.
  const persistedCase = await caseRepository.getById(caseRecord.id.value);

  // Confirmamos que el aggregate fue guardado en estado resuelto con captura exitosa.
  assert.ok(persistedCase);
  assert.equal(persistedCase.state, CaseState.RESOLVED);
  assert.equal(persistedCase.resolution?.outcome, "Arrested");

  // Confirmamos que la vista de aplicacion ya revele el resultado final.
  assert.equal(caseStatusView.resolution?.cause, "ArrestSuccess");

  // Confirmamos que la aplicacion publique el evento de resolucion esperado.
  assert.deepEqual(
    eventBus.publishedEvents.map((domainEvent: { type: string }) => domainEvent.type),
    ["CaseResolved"]
  );

  // Confirmamos que la accion deje una huella tecnica de telemetria.
  assert.equal(telemetry.recordedEntries.length, 1);
  assert.equal(telemetry.recordedEntries[0].eventName, "arrest_attempted");
});
