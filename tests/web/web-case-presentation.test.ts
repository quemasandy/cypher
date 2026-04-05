/**
 * Este archivo prueba las proyecciones puras del adapter web.
 * Su rol arquitectonico es blindar la logica de presentacion final sin
 * depender del DOM, del servidor HTTP ni de APIs del navegador.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CaseStatusView } from "@cipher/application";
import {
  CaseResolutionCauseValues,
  CaseResolutionOutcomeValues,
  CaseState
} from "@cipher/domain";
import {
  createFreshCaseSeed,
  createInvestigationReport,
  deriveCaseProgressSnapshot,
  normalizeSeedInput,
  resolvePrimaryActionPlan
} from "../../apps/web/src/web-case-presentation.js";

function createCaseStatusView(overrides: Partial<CaseStatusView> = {}): CaseStatusView {
  return {
    caseId: "case-web-001",
    state: CaseState.INVESTIGATING,
    agentName: "Avery Stone",
    agencyName: "TRACE",
    targetAlias: "Cipher",
    discoveredTraits: [],
    discoveredTraitLabels: [],
    artifactName: "Sun Disk",
    artifactOrigin: "Cusco",
    currentCityId: "quito",
    currentCityName: "Quito",
    remainingTimeHours: 42,
    issuedWarrant: null,
    resolution: null,
    availableLocations: [
      {
        id: "market",
        name: "Night Market",
        isVisited: false,
        clueSummary: null
      },
      {
        id: "museum",
        name: "Transit Museum",
        isVisited: false,
        clueSummary: null
      }
    ],
    availableTravelDestinations: [],
    visitedLocationNames: [],
    collectedClues: [],
    travelHistory: [],
    headline: "Avery Stone is investigating Sun Disk in Quito.",
    timePressureMessage: "42 virtual hours remain before Cipher escapes.",
    ...overrides
  };
}

test("normalizeSeedInput falls back to the tutorial seed when the field is blank", () => {
  assert.equal(normalizeSeedInput("   ", "tutorial-case-v1"), "tutorial-case-v1");
  assert.equal(normalizeSeedInput(" custom-seed ", "tutorial-case-v1"), "custom-seed");
});

test("createFreshCaseSeed keeps a readable deterministic timestamp format", () => {
  const seed = createFreshCaseSeed(new Date(2026, 3, 5, 11, 24, 36));
  assert.equal(seed, "web-case-20260405-112436");
});

test("resolvePrimaryActionPlan recommends visiting a location during early investigation", () => {
  const actionPlan = resolvePrimaryActionPlan(createCaseStatusView());

  assert.deepEqual(actionPlan, {
    kind: "visit_location",
    label: "Inspect Night Market",
    description: "The case still needs more visible trait evidence before a safe warrant.",
    locationId: "market"
  });
});

test("resolvePrimaryActionPlan recommends submitting the warrant after enough traits", () => {
  const actionPlan = resolvePrimaryActionPlan(
    createCaseStatusView({
      discoveredTraits: [
        { code: "gloves", label: "Precise leather gloves" },
        { code: "accent", label: "Measured coastal accent" }
      ],
      discoveredTraitLabels: [
        "Precise leather gloves",
        "Measured coastal accent"
      ]
    })
  );

  assert.deepEqual(actionPlan, {
    kind: "submit_warrant",
    label: "Submit Warrant",
    description: "You already have enough visible trait evidence to commit a legal hypothesis."
  });
});

test("deriveCaseProgressSnapshot reaches 100 percent for resolved cases", () => {
  const progressSnapshot = deriveCaseProgressSnapshot(
    createCaseStatusView({
      state: CaseState.RESOLVED,
      discoveredTraits: [
        { code: "gloves", label: "Precise leather gloves" }
      ],
      discoveredTraitLabels: ["Precise leather gloves"],
      issuedWarrant: {
        suspectedTraits: [{ code: "gloves", label: "Precise leather gloves" }]
      },
      resolution: {
        outcome: CaseResolutionOutcomeValues.ARRESTED,
        cause: CaseResolutionCauseValues.ARREST_SUCCESS,
        summary: "Cipher was captured in the final pursuit."
      },
      visitedLocationNames: ["Night Market"],
      availableLocations: [
        {
          id: "market",
          name: "Night Market",
          isVisited: true,
          clueSummary: "A witness described careful leather gloves."
        }
      ]
    })
  );

  assert.equal(progressSnapshot.stageLabel, "Case Closed");
  assert.equal(progressSnapshot.completionPercent, 100);
  assert.match(progressSnapshot.summary, /captured/i);
});

test("createInvestigationReport includes resolution and architecture trace data", () => {
  const report = createInvestigationReport({
    seed: "tutorial-case-v1",
    caseStatusView: createCaseStatusView({
      state: CaseState.RESOLVED,
      discoveredTraits: [
        { code: "gloves", label: "Precise leather gloves" }
      ],
      discoveredTraitLabels: ["Precise leather gloves"],
      issuedWarrant: {
        suspectedTraits: [{ code: "gloves", label: "Precise leather gloves" }]
      },
      resolution: {
        outcome: CaseResolutionOutcomeValues.ARRESTED,
        cause: CaseResolutionCauseValues.ARREST_SUCCESS,
        summary: "Cipher was captured in the final pursuit."
      },
      collectedClues: ["A witness described careful leather gloves."],
      travelHistory: [
        {
          fromCityId: "quito",
          toCityId: "lima",
          fromCityName: "Quito",
          toCityName: "Lima",
          travelTimeHours: 5
        }
      ]
    }),
    publishedEvents: [
      { type: "CaseStarted" },
      { type: "CipherArrested" }
    ],
    recordedTelemetryEntries: [
      { eventName: "case_started", payload: { seed: "tutorial-case-v1" } },
      { eventName: "arrest_attempted", payload: { outcome: "Arrested" } }
    ],
    feedbackMessage: "Downloaded the current investigation report."
  });

  assert.match(report, /Resolution/);
  assert.match(report, /Arrested - Cipher was captured in the final pursuit\./);
  assert.match(report, /Published domain events: 2/);
  assert.match(report, /Last telemetry event: arrest_attempted/);
  assert.match(report, /Last browser banner: Downloaded the current investigation report\./);
});
