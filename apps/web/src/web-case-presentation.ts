/**
 * Este archivo concentra proyecciones puras del adapter web.
 * Su rol arquitectonico es mantener la UI final explicable y testeable:
 * aqui derivamos progreso, recomendacion de siguiente paso y el reporte exportable
 * sin mezclar esa logica con DOM, eventos del navegador o efectos secundarios.
 */
import type { CaseStatusView } from "@cipher/application";
import { CaseState } from "@cipher/domain";
import type { TelemetryEntry } from "@cipher/infra/browser";

export interface WebProgressMilestone {
  label: string;
  detail: string;
  isReached: boolean;
}

export interface WebCaseProgressSnapshot {
  stageLabel: string;
  completionPercent: number;
  summary: string;
  milestones: WebProgressMilestone[];
}

export interface WebPrimaryActionPlan {
  kind:
    | "start_case"
    | "visit_location"
    | "travel_to_city"
    | "submit_warrant"
    | "attempt_arrest";
  label: string;
  description: string;
  locationId?: string;
  destinationCityId?: string;
}

export interface WebRecommendedActionCopy {
  title: string;
  description: string;
}

export interface InvestigationReportInput {
  seed: string;
  caseStatusView: CaseStatusView | null;
  publishedEvents: ReadonlyArray<{ type: string }>;
  recordedTelemetryEntries: ReadonlyArray<TelemetryEntry>;
  feedbackMessage: string | null;
}

/**
 * Este helper normaliza la `seed` ingresada por el jugador.
 * Si la caja esta vacia, degradamos a una `seed` segura para evitar errores de UX evitables.
 */
export function normalizeSeedInput(rawSeed: string, fallbackSeed: string): string {
  const normalizedSeed = rawSeed.trim();
  return normalizedSeed.length > 0 ? normalizedSeed : fallbackSeed;
}

/**
 * Este helper genera una `seed` fresca pero legible para demos web.
 * Conserva reproducibilidad porque la `seed` final siempre queda visible en la UI.
 */
export function createFreshCaseSeed(now: Date = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `web-case-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Este helper calcula la accion principal sugerida por la UI.
 * La intencion es que el boton visible y el atajo de teclado `Enter` sigan exactamente la misma regla.
 */
export function resolvePrimaryActionPlan(
  caseStatusView: CaseStatusView | null
): WebPrimaryActionPlan | null {
  if (caseStatusView === null) {
    return {
      kind: "start_case",
      label: "Open Case",
      description: "Generate a reproducible briefing from the seed currently shown in the dossier."
    };
  }

  if (caseStatusView.state === CaseState.INVESTIGATING) {
    const firstPendingLocation = caseStatusView.availableLocations.find(
      (location) => !location.isVisited
    );

    // Antes de comprometer una warrant, priorizamos seguir recolectando evidencia visible.
    if (caseStatusView.discoveredTraits.length < 2 && firstPendingLocation) {
      return {
        kind: "visit_location",
        label: `Inspect ${firstPendingLocation.name}`,
        description: "The case still needs more visible trait evidence before a safe warrant.",
        locationId: firstPendingLocation.id
      };
    }

    if (
      caseStatusView.discoveredTraits.length >= 2 &&
      caseStatusView.issuedWarrant === null
    ) {
      return {
        kind: "submit_warrant",
        label: "Submit Warrant",
        description: "You already have enough visible trait evidence to commit a legal hypothesis."
      };
    }

    const firstKnownDestination = caseStatusView.availableTravelDestinations[0];

    if (firstKnownDestination) {
      return {
        kind: "travel_to_city",
        label: `Travel to ${firstKnownDestination.name}`,
        description: "Route evidence already exposed a valid next city from the current location.",
        destinationCityId: firstKnownDestination.id
      };
    }

    if (firstPendingLocation) {
      return {
        kind: "visit_location",
        label: `Inspect ${firstPendingLocation.name}`,
        description: "No travel route is visible yet, so the next step is to gather more clues locally.",
        locationId: firstPendingLocation.id
      };
    }
  }

  if (caseStatusView.state === CaseState.WARRANT_ISSUED) {
    const firstKnownDestination = caseStatusView.availableTravelDestinations[0];

    if (firstKnownDestination) {
      return {
        kind: "travel_to_city",
        label: `Pursue ${firstKnownDestination.name}`,
        description: "The warrant is active. Keep moving until the chase reaches Cipher's final city.",
        destinationCityId: firstKnownDestination.id
      };
    }
  }

  if (caseStatusView.state === CaseState.CHASE) {
    return {
      kind: "attempt_arrest",
      label: "Attempt Arrest",
      description: "You are already in the final pursuit phase. Resolve the case now."
    };
  }

  return null;
}

/**
 * Este helper produce el texto explicativo del panel de recomendacion.
 * Se separa del plan accionable para que la UI pueda seguir mostrando orientacion aun sin CTA.
 */
export function deriveRecommendedActionCopy(
  caseStatusView: CaseStatusView | null,
  primaryActionPlan: WebPrimaryActionPlan | null
): WebRecommendedActionCopy {
  if (primaryActionPlan) {
    return {
      title: primaryActionPlan.label,
      description: primaryActionPlan.description
    };
  }

  if (caseStatusView === null) {
    return {
      title: "Prepare the dossier",
      description: "Pick a seed and open a reproducible case from the browser."
    };
  }

  if (caseStatusView.state === CaseState.RESOLVED) {
    return {
      title: "Review the final dossier",
      description: "Export the report, inspect the architecture trace and then open the next case."
    };
  }

  return {
    title: "Review the current dossier",
    description: "No dominant action is available right now. Reassess clues, routes and the current warrant."
  };
}

/**
 * Este helper traduce el estado actual del caso a una barra de progreso visible.
 * La barra no pretende adivinar el futuro del caso; solo resume hitos ya alcanzados.
 */
export function deriveCaseProgressSnapshot(
  caseStatusView: CaseStatusView | null
): WebCaseProgressSnapshot {
  const milestones: WebProgressMilestone[] = [
    {
      label: "Case opened",
      detail: "A reproducible dossier has been generated from the current seed.",
      isReached: caseStatusView !== null
    },
    {
      label: "First location inspected",
      detail: "The investigation has produced at least one visible clue.",
      isReached: (caseStatusView?.visitedLocationNames.length ?? 0) > 0
    },
    {
      label: "Trait evidence consolidated",
      detail: "The dossier already contains actionable trait clues for the warrant.",
      isReached: (caseStatusView?.discoveredTraits.length ?? 0) > 0
    },
    {
      label: "Warrant committed",
      detail: "The investigation has moved from open evidence gathering to legal commitment.",
      isReached: caseStatusView?.issuedWarrant !== null
    },
    {
      label: "Final outcome reached",
      detail: "The case has been resolved as arrest or escape.",
      isReached: caseStatusView?.state === CaseState.RESOLVED
    }
  ];

  const reachedMilestoneCount = milestones.filter((milestone) => milestone.isReached).length;
  const completionPercent =
    milestones.length === 0 ? 0 : Math.round((reachedMilestoneCount / milestones.length) * 100);

  if (caseStatusView === null) {
    return {
      stageLabel: "Briefing Pending",
      completionPercent,
      summary: "The browser adapter is ready to open a new dossier, but no case is active yet.",
      milestones
    };
  }

  switch (caseStatusView.state) {
    case CaseState.INVESTIGATING:
      return {
        stageLabel: "Investigation Active",
        completionPercent,
        summary:
          caseStatusView.discoveredTraits.length === 0
            ? "The case is still in early investigation. Prioritize local clues before committing to a route."
            : "The dossier already contains trait evidence. Decide whether to keep probing or commit the warrant.",
        milestones
      };
    case CaseState.WARRANT_ISSUED:
      return {
        stageLabel: "Warrant In Motion",
        completionPercent,
        summary: "The legal hypothesis is already committed. The remaining work is operational pursuit.",
        milestones
      };
    case CaseState.CHASE:
      return {
        stageLabel: "Final Pursuit",
        completionPercent,
        summary: "Cipher is cornered. The next irreversible step is the arrest attempt.",
        milestones
      };
    case CaseState.RESOLVED:
      return {
        stageLabel: "Case Closed",
        completionPercent,
        summary:
          caseStatusView.resolution?.summary ??
          "The case has already reached a final outcome.",
        milestones
      };
    default:
      return {
        stageLabel: "Briefing",
        completionPercent,
        summary: "The dossier exists, but the main investigation has not started yet.",
        milestones
      };
  }
}

/**
 * Este helper construye un reporte textual exportable del caso.
 * La salida es deliberadamente plana para que funcione igual al copiarla o descargarla.
 */
export function createInvestigationReport({
  seed,
  caseStatusView,
  publishedEvents,
  recordedTelemetryEntries,
  feedbackMessage
}: InvestigationReportInput): string {
  if (caseStatusView === null) {
    return [
      "Cipher Investigation Report",
      "==========================",
      `Seed: ${seed}`,
      "",
      "No case is active in the browser yet.",
      "Open a case from this seed to generate a full dossier."
    ].join("\n");
  }

  const primaryActionPlan = resolvePrimaryActionPlan(caseStatusView);
  const progressSnapshot = deriveCaseProgressSnapshot(caseStatusView);
  const recommendedActionCopy = deriveRecommendedActionCopy(caseStatusView, primaryActionPlan);

  const reportLines = [
    "Cipher Investigation Report",
    "==========================",
    `Seed: ${seed}`,
    `Case ID: ${caseStatusView.caseId}`,
    `State: ${caseStatusView.state}`,
    `Agent: ${caseStatusView.agentName} (${caseStatusView.agencyName})`,
    `Artifact: ${caseStatusView.artifactName} from ${caseStatusView.artifactOrigin}`,
    `Current city: ${caseStatusView.currentCityName}`,
    `Remaining time: ${caseStatusView.remainingTimeHours}h`,
    "",
    "Operational summary",
    "-------------------",
    caseStatusView.headline,
    caseStatusView.timePressureMessage,
    "",
    `Stage: ${progressSnapshot.stageLabel} (${progressSnapshot.completionPercent}%)`,
    progressSnapshot.summary,
    "",
    "Recommended next step",
    "---------------------",
    recommendedActionCopy.title,
    recommendedActionCopy.description,
    ""
  ];

  const discoveredTraitLines =
    caseStatusView.discoveredTraitLabels.length === 0
      ? ["No discovered trait evidence yet."]
      : caseStatusView.discoveredTraitLabels.map((traitLabel) => `- ${traitLabel}`);
  const collectedClueLines =
    caseStatusView.collectedClues.length === 0
      ? ["No clue collected yet."]
      : caseStatusView.collectedClues.map((clue) => `- ${clue}`);
  const travelHistoryLines =
    caseStatusView.travelHistory.length === 0
      ? ["No travel recorded yet."]
      : caseStatusView.travelHistory.map(
          (travelEntry) =>
            `- ${travelEntry.fromCityName} -> ${travelEntry.toCityName} (${travelEntry.travelTimeHours}h)`
        );
  const warrantLines =
    caseStatusView.issuedWarrant === null
      ? ["No warrant issued yet."]
      : caseStatusView.issuedWarrant.suspectedTraits.map((trait) => `- ${trait.label}`);

  reportLines.push("Discovered traits");
  reportLines.push("-----------------");
  reportLines.push(...discoveredTraitLines);
  reportLines.push("");

  reportLines.push("Collected clues");
  reportLines.push("---------------");
  reportLines.push(...collectedClueLines);
  reportLines.push("");

  reportLines.push("Travel history");
  reportLines.push("--------------");
  reportLines.push(...travelHistoryLines);
  reportLines.push("");

  reportLines.push("Warrant");
  reportLines.push("-------");
  reportLines.push(...warrantLines);
  reportLines.push("");

  reportLines.push("Resolution");
  reportLines.push("----------");
  reportLines.push(
    caseStatusView.resolution === null
      ? "Case still active."
      : `${caseStatusView.resolution.outcome} - ${caseStatusView.resolution.summary}`
  );
  reportLines.push("");

  reportLines.push("Architecture trace");
  reportLines.push("------------------");
  reportLines.push(`Published domain events: ${publishedEvents.length}`);
  reportLines.push(`Last domain event: ${publishedEvents.at(-1)?.type ?? "none"}`);
  reportLines.push(`Recorded telemetry entries: ${recordedTelemetryEntries.length}`);
  reportLines.push(`Last telemetry event: ${recordedTelemetryEntries.at(-1)?.eventName ?? "none"}`);

  if (feedbackMessage) {
    reportLines.push(`Last browser banner: ${feedbackMessage}`);
  }

  return reportLines.join("\n");
}
