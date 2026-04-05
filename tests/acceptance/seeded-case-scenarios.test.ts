/**
 * Este archivo contiene escenarios de aceptacion sobre casos generados por `seed`.
 * Su rol es fijar el loop narrativo completo del MVP: ganar, perder por tiempo y
 * perder por warrant incorrecta usando exactamente los mismos casos de uso que usa la CLI.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState, CaseResolutionCauseValues, CaseResolutionOutcomeValues } from "@cipher/domain";
import {
  AttemptArrest,
  StartCase,
  SubmitWarrant,
  TravelToCity,
  VisitLocation,
  type CaseStatusView
} from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry,
  ProceduralCaseGenerator
} from "@cipher/infra";

interface SeededScenarioHarness {
  startCase: StartCase;
  visitLocation: VisitLocation;
  travelToCity: TravelToCity;
  submitWarrant: SubmitWarrant;
  attemptArrest: AttemptArrest;
}

/**
 * Este helper arma un grafo minimo de aplicacion para un escenario completo.
 */
function createSeededScenarioHarness(): SeededScenarioHarness {
  const caseRepository = new InMemoryCaseRepository();
  const caseGenerator = new ProceduralCaseGenerator();
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();

  return {
    startCase: new StartCase({
      caseGenerator,
      caseRepository,
      eventBus,
      telemetry
    }),
    visitLocation: new VisitLocation({
      caseRepository,
      eventBus,
      telemetry
    }),
    travelToCity: new TravelToCity({
      caseRepository,
      eventBus,
      telemetry
    }),
    submitWarrant: new SubmitWarrant({
      caseRepository,
      eventBus,
      telemetry
    }),
    attemptArrest: new AttemptArrest({
      caseRepository,
      eventBus,
      telemetry
    })
  };
}

/**
 * Este helper visita la primera locacion pendiente visible en la vista actual.
 */
async function visitFirstPendingLocation(
  visitLocation: VisitLocation,
  caseStatusView: CaseStatusView
): Promise<CaseStatusView> {
  const pendingLocation = caseStatusView.availableLocations.find((location) => !location.isVisited);

  assert.ok(pendingLocation, "Expected at least one pending location in the generated case.");

  return visitLocation.execute({
    caseId: caseStatusView.caseId,
    locationId: pendingLocation.id
  });
}

/**
 * Este helper viaja al primer destino disponible para mantener los escenarios lineales y legibles.
 */
async function travelToFirstDestination(
  travelToCity: TravelToCity,
  caseStatusView: CaseStatusView
): Promise<CaseStatusView> {
  const firstDestination = caseStatusView.availableTravelDestinations[0];

  assert.ok(firstDestination, "Expected at least one travel destination in the generated case.");

  return travelToCity.execute({
    caseId: caseStatusView.caseId,
    destinationCityId: firstDestination.id
  });
}

/**
 * Este helper sigue inspeccionando locaciones hasta reunir una cantidad minima de rasgos deducidos.
 * Mantiene los escenarios alineados con la regla nueva: la warrant debe salir de evidencia visible.
 */
async function collectTraitEvidenceUntil(
  visitLocation: VisitLocation,
  caseStatusView: CaseStatusView,
  minimumDiscoveredTraitCount: number
): Promise<CaseStatusView> {
  let currentCaseStatusView = caseStatusView;

  while (
    currentCaseStatusView.state === CaseState.INVESTIGATING &&
    currentCaseStatusView.discoveredTraits.length < minimumDiscoveredTraitCount
  ) {
    currentCaseStatusView = await visitFirstPendingLocation(visitLocation, currentCaseStatusView);
  }

  return currentCaseStatusView;
}

test("A seeded case can be solved through the intended route", async () => {
  const scenarioHarness = createSeededScenarioHarness();

  // Abrimos el caso desde una `seed` conocida para este escenario.
  let caseStatusView = await scenarioHarness.startCase.execute({
    seed: "acceptance-win-seed"
  });

  // Recorremos el mismo camino principal que luego usa la demo CLI.
  caseStatusView = await collectTraitEvidenceUntil(
    scenarioHarness.visitLocation,
    caseStatusView,
    1
  );
  caseStatusView = await travelToFirstDestination(scenarioHarness.travelToCity, caseStatusView);
  caseStatusView = await collectTraitEvidenceUntil(
    scenarioHarness.visitLocation,
    caseStatusView,
    2
  );

  caseStatusView = await scenarioHarness.submitWarrant.execute({
    caseId: caseStatusView.caseId,
    suspectedTraits: caseStatusView.discoveredTraits
  });

  caseStatusView = await travelToFirstDestination(scenarioHarness.travelToCity, caseStatusView);

  assert.equal(caseStatusView.state, CaseState.CHASE);

  caseStatusView = await scenarioHarness.attemptArrest.execute({
    caseId: caseStatusView.caseId
  });

  assert.equal(caseStatusView.state, CaseState.RESOLVED);
  assert.equal(caseStatusView.resolution?.outcome, CaseResolutionOutcomeValues.ARRESTED);
  assert.equal(caseStatusView.resolution?.cause, CaseResolutionCauseValues.ARREST_SUCCESS);
});

test("A seeded case can end because time expires", async () => {
  const scenarioHarness = createSeededScenarioHarness();

  // Abrimos el caso desde una `seed` distinta para no acoplar los escenarios entre si.
  let caseStatusView = await scenarioHarness.startCase.execute({
    seed: "acceptance-timeout-seed"
  });

  // Consumimos primero locaciones nuevas y luego viajes repetibles hasta agotar el tiempo.
  while (caseStatusView.state !== CaseState.RESOLVED) {
    const hasPendingLocations = caseStatusView.availableLocations.some(
      (location) => !location.isVisited
    );

    if (hasPendingLocations) {
      caseStatusView = await visitFirstPendingLocation(scenarioHarness.visitLocation, caseStatusView);
      continue;
    }

    caseStatusView = await travelToFirstDestination(scenarioHarness.travelToCity, caseStatusView);
  }

  assert.equal(caseStatusView.resolution?.outcome, CaseResolutionOutcomeValues.ESCAPED);
  assert.equal(caseStatusView.resolution?.cause, CaseResolutionCauseValues.TIME_EXPIRED);
});

test("A seeded case can end with Cipher escaping after a wrong warrant", async () => {
  const scenarioHarness = createSeededScenarioHarness();

  // Abrimos el caso y seguimos la ruta correcta, pero comprometemos una warrant incompleta.
  let caseStatusView = await scenarioHarness.startCase.execute({
    seed: "acceptance-wrong-warrant-seed"
  });

  caseStatusView = await collectTraitEvidenceUntil(
    scenarioHarness.visitLocation,
    caseStatusView,
    1
  );
  caseStatusView = await travelToFirstDestination(scenarioHarness.travelToCity, caseStatusView);
  caseStatusView = await collectTraitEvidenceUntil(
    scenarioHarness.visitLocation,
    caseStatusView,
    2
  );

  caseStatusView = await scenarioHarness.submitWarrant.execute({
    caseId: caseStatusView.caseId,
    suspectedTraits: caseStatusView.discoveredTraits.slice(0, 1)
  });

  caseStatusView = await travelToFirstDestination(scenarioHarness.travelToCity, caseStatusView);

  assert.equal(caseStatusView.state, CaseState.CHASE);

  caseStatusView = await scenarioHarness.attemptArrest.execute({
    caseId: caseStatusView.caseId
  });

  assert.equal(caseStatusView.state, CaseState.RESOLVED);
  assert.equal(caseStatusView.resolution?.outcome, CaseResolutionOutcomeValues.ESCAPED);
  assert.equal(caseStatusView.resolution?.cause, CaseResolutionCauseValues.WRONG_WARRANT);
});
