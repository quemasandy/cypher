/**
 * Este archivo implementa el adapter web final del alcance local-first.
 * Su trabajo es traducir interacciones del navegador a los mismos casos de uso
 * que ya consumen la CLI y los tests, sin introducir logica de dominio nueva.
 */
import {
  AttemptArrest,
  GetCaseStatus,
  StartCase,
  SubmitWarrant,
  TravelToCity,
  VisitLocation,
  type CaseStatusView
} from "@cipher/application";
import {
  DEMO_CASE_SEED,
  InMemoryEventBus,
  InMemoryTelemetry,
  LocalStorageCaseRepository,
  ProceduralCaseGenerator
} from "@cipher/infra/browser";
import type { BrowserKeyValueStore } from "@cipher/infra/browser";
import {
  clearPersistedWebSessionSnapshot,
  loadPersistedWebSessionSnapshot,
  savePersistedWebSessionSnapshot
} from "./web-session-storage.js";
import {
  createFreshCaseSeed,
  createInvestigationReport,
  deriveCaseProgressSnapshot,
  deriveRecommendedActionCopy,
  normalizeSeedInput,
  resolvePrimaryActionPlan
} from "./web-case-presentation.js";

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}

interface WebSession {
  caseRepository: LocalStorageCaseRepository;
  getCaseStatus: GetCaseStatus;
  startCase: StartCase;
  visitLocation: VisitLocation;
  travelToCity: TravelToCity;
  submitWarrant: SubmitWarrant;
  attemptArrest: AttemptArrest;
  eventBus: InMemoryEventBus;
  telemetry: InMemoryTelemetry;
}

interface WebFeedbackBanner {
  kind: "error" | "info" | "success";
  message: string;
}

interface WebAdapterState {
  seed: string;
  currentCaseStatusView: CaseStatusView | null;
  selectedTraitCodes: Set<string>;
  feedbackBanner: WebFeedbackBanner | null;
  session: WebSession;
}

const applicationRootElement = getRequiredApplicationRootElement();
const browserStorage = resolveBrowserStorage();

let webAdapterState: WebAdapterState = {
  seed: DEMO_CASE_SEED,
  currentCaseStatusView: null,
  selectedTraitCodes: new Set(),
  feedbackBanner: null,
  session: createWebSession(browserStorage)
};

/**
 * Este helper crea una sesion web local-first sobre `localStorage`.
 * El dominio sigue igual; solo cambia el adapter de persistencia usado por la UI.
 */
function createWebSession(browserStorageAdapter: BrowserKeyValueStore): WebSession {
  const caseRepository = new LocalStorageCaseRepository({
    browserStorage: browserStorageAdapter
  });
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();
  const caseGenerator = new ProceduralCaseGenerator();

  return {
    caseRepository,
    getCaseStatus: new GetCaseStatus({
      caseRepository
    }),
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
    }),
    eventBus,
    telemetry
  };
}

function createEmptyWebAdapterState(
  seed: string,
  session: WebSession
): WebAdapterState {
  return {
    seed,
    currentCaseStatusView: null,
    selectedTraitCodes: new Set(),
    feedbackBanner: null,
    session
  };
}

/**
 * Este bootstrap recompone el estado de la UI desde `localStorage`.
 * El caso visible se vuelve a leer mediante `GetCaseStatus` para probar que la
 * rehidratacion realmente funciona y no depende de snapshots de vista guardados.
 */
async function createInitialWebAdapterState(): Promise<WebAdapterState> {
  const restoredSessionSnapshot = loadPersistedWebSessionSnapshot({
    browserStorage
  });
  const restoredSeed = restoredSessionSnapshot?.seed || DEMO_CASE_SEED;
  const restoredSession = createWebSession(browserStorage);
  const restoredState = createEmptyWebAdapterState(restoredSeed, restoredSession);

  if (restoredSessionSnapshot === null) {
    return restoredState;
  }

  restoredState.selectedTraitCodes = new Set(
    restoredSessionSnapshot.selectedTraitCodes
  );

  // Restauramos la traza visible para que la UI siga explicando que ya ocurrio.
  restoredSession.eventBus.publishedEvents.push(
    ...restoredSessionSnapshot.publishedEvents.map((publishedEvent) => ({
      ...publishedEvent
    }))
  );
  restoredSession.telemetry.recordedEntries.push(
    ...restoredSessionSnapshot.recordedTelemetryEntries.map((telemetryEntry) => ({
      eventName: telemetryEntry.eventName,
      payload: { ...telemetryEntry.payload }
    }))
  );

  if (restoredSessionSnapshot.activeCaseId === null) {
    return restoredState;
  }

  try {
    restoredState.currentCaseStatusView =
      await restoredSession.getCaseStatus.execute({
        caseId: restoredSessionSnapshot.activeCaseId
      });

    restoredState.feedbackBanner = {
      kind: "info",
      message: "Recovered the active case from browser storage."
    };
  } catch (error: unknown) {
    // Si la sesion guardada apunta a un caso roto o inconsistente, limpiamos storage y arrancamos de cero.
    await restoredSession.caseRepository.deleteById(restoredSessionSnapshot.activeCaseId);
    clearPersistedWebSessionSnapshot({ browserStorage });

    return {
      ...createEmptyWebAdapterState(restoredSeed, createWebSession(browserStorage)),
      feedbackBanner: {
        kind: "error",
        message:
          error instanceof Error
            ? `Stored browser session could not be restored. ${error.message}`
            : "Stored browser session could not be restored."
      }
    };
  }

  return restoredState;
}

function persistCurrentWebAdapterState(): void {
  savePersistedWebSessionSnapshot({
    browserStorage,
    sessionSnapshot: {
      version: 1,
      seed: webAdapterState.seed || DEMO_CASE_SEED,
      activeCaseId: webAdapterState.currentCaseStatusView?.caseId ?? null,
      selectedTraitCodes: [...webAdapterState.selectedTraitCodes],
      publishedEvents: webAdapterState.session.eventBus.publishedEvents,
      recordedTelemetryEntries: webAdapterState.session.telemetry.recordedEntries
    }
  });
}

async function deletePersistedCurrentCaseRecord(): Promise<void> {
  const activeCaseId = webAdapterState.currentCaseStatusView?.caseId;

  if (!activeCaseId) {
    return;
  }

  await webAdapterState.session.caseRepository.deleteById(activeCaseId);
}

async function resetBrowserSession(): Promise<void> {
  await deletePersistedCurrentCaseRecord();
  clearPersistedWebSessionSnapshot({ browserStorage });
  webAdapterState = createEmptyWebAdapterState(
    webAdapterState.seed || DEMO_CASE_SEED,
    createWebSession(browserStorage)
  );
  setFeedbackBanner("info", "Browser session cleared. The next case will start from the current seed.");
}

function setFeedbackBanner(kind: WebFeedbackBanner["kind"], message: string): void {
  webAdapterState.feedbackBanner = {
    kind,
    message
  };
}

function clearFeedbackBanner(): void {
  webAdapterState.feedbackBanner = null;
}

/**
 * Este helper vuelve serializable el estado visible para pruebas automatizadas del skill.
 * La salida no intenta ser un snapshot completo del dominio: solo resume lo relevante para la UI.
 */
function renderGameToText(): string {
  const primaryActionPlan = resolvePrimaryActionPlan(webAdapterState.currentCaseStatusView);
  const progressSnapshot = deriveCaseProgressSnapshot(webAdapterState.currentCaseStatusView);

  return JSON.stringify({
    mode: webAdapterState.currentCaseStatusView === null ? "briefing" : "case",
    note:
      "This web adapter uses DOM panels, exports investigation reports and persists its active session in localStorage.",
    storageMode: "localStorage",
    seed: webAdapterState.seed,
    caseId: webAdapterState.currentCaseStatusView?.caseId ?? null,
    state: webAdapterState.currentCaseStatusView?.state ?? null,
    currentCity: webAdapterState.currentCaseStatusView?.currentCityName ?? null,
    remainingTimeHours: webAdapterState.currentCaseStatusView?.remainingTimeHours ?? null,
    progressStage: progressSnapshot.stageLabel,
    progressPercent: progressSnapshot.completionPercent,
    recommendedAction: primaryActionPlan?.label ?? null,
    discoveredTraits:
      webAdapterState.currentCaseStatusView?.discoveredTraitLabels ?? [],
    pendingLocations:
      webAdapterState.currentCaseStatusView?.availableLocations
        .filter((location) => !location.isVisited)
        .map((location) => location.name) ?? [],
    travelOptions:
      webAdapterState.currentCaseStatusView?.availableTravelDestinations.map(
        (destination) => destination.name
      ) ?? [],
    canSubmitWarrant:
      webAdapterState.currentCaseStatusView?.state === "Investigating" &&
      (webAdapterState.currentCaseStatusView?.discoveredTraits.length ?? 0) > 0,
    canAttemptArrest: webAdapterState.currentCaseStatusView?.state === "Chase",
    lastDomainEventType:
      webAdapterState.session.eventBus.publishedEvents.at(-1)?.type ?? null,
    lastTelemetryEvent:
      webAdapterState.session.telemetry.recordedEntries.at(-1)?.eventName ?? null,
    feedback: webAdapterState.feedbackBanner?.message ?? null
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = () => {
  // Esta UI no depende de frames ni animaciones de gameplay, asi que el hook es un no-op determinista.
};

async function startCaseFromSeed(): Promise<void> {
  const normalizedSeed = normalizeSeedInput(webAdapterState.seed, DEMO_CASE_SEED);

  // Antes de abrir otro caso limpiamos la sesion anterior para mantener un solo hilo activo en el browser.
  await deletePersistedCurrentCaseRecord();
  clearPersistedWebSessionSnapshot({ browserStorage });
  webAdapterState = createEmptyWebAdapterState(
    normalizedSeed,
    createWebSession(browserStorage)
  );

  webAdapterState.currentCaseStatusView = await webAdapterState.session.startCase.execute({
    seed: normalizedSeed
  });
  setFeedbackBanner("success", `Opened a new case from seed ${normalizedSeed}.`);
}

async function visitLocation(locationId: string): Promise<void> {
  if (!webAdapterState.currentCaseStatusView) {
    return;
  }

  const visitedLocation =
    webAdapterState.currentCaseStatusView.availableLocations.find(
      (location) => location.id === locationId
    ) ?? null;

  webAdapterState.currentCaseStatusView = await webAdapterState.session.visitLocation.execute({
    caseId: webAdapterState.currentCaseStatusView.caseId,
    locationId
  });
  setFeedbackBanner(
    "info",
    `Inspected ${visitedLocation?.name ?? "the selected location"} and refreshed the clue trail.`
  );
}

async function travelToCity(destinationCityId: string): Promise<void> {
  if (!webAdapterState.currentCaseStatusView) {
    return;
  }

  const selectedDestination =
    webAdapterState.currentCaseStatusView.availableTravelDestinations.find(
      (destination) => destination.id === destinationCityId
    ) ?? null;

  webAdapterState.currentCaseStatusView = await webAdapterState.session.travelToCity.execute({
    caseId: webAdapterState.currentCaseStatusView.caseId,
    destinationCityId
  });
  setFeedbackBanner(
    "info",
    `Traveled to ${selectedDestination?.name ?? "the selected city"} and refreshed the route evidence.`
  );
}

async function submitWarrant(): Promise<void> {
  if (!webAdapterState.currentCaseStatusView) {
    return;
  }

  const selectedTraits =
    webAdapterState.currentCaseStatusView.discoveredTraits.filter((trait) =>
      webAdapterState.selectedTraitCodes.has(trait.code)
    );
  const effectiveTraits =
    selectedTraits.length > 0
      ? selectedTraits
      : webAdapterState.currentCaseStatusView.discoveredTraits;

  webAdapterState.currentCaseStatusView = await webAdapterState.session.submitWarrant.execute({
    caseId: webAdapterState.currentCaseStatusView.caseId,
    suspectedTraits: effectiveTraits
  });
  setFeedbackBanner(
    "success",
    `Submitted a warrant backed by ${effectiveTraits.length} discovered trait clue${effectiveTraits.length === 1 ? "" : "s"}.`
  );
}

async function attemptArrest(): Promise<void> {
  if (!webAdapterState.currentCaseStatusView) {
    return;
  }

  webAdapterState.currentCaseStatusView = await webAdapterState.session.attemptArrest.execute({
    caseId: webAdapterState.currentCaseStatusView.caseId
  });

  if (webAdapterState.currentCaseStatusView.resolution?.outcome === "Arrested") {
    setFeedbackBanner("success", "Cipher was arrested. Export the dossier or start the next case.");
    return;
  }

  setFeedbackBanner("info", "Cipher escaped. Review the dossier and the route history before retrying.");
}

/**
 * Este helper define una accion primaria de teclado para pruebas y accesibilidad minima.
 * Prioriza avanzar el loop principal con la menor cantidad de decisiones posibles.
 */
async function runPrimaryKeyboardAction(): Promise<void> {
  const primaryActionPlan = resolvePrimaryActionPlan(webAdapterState.currentCaseStatusView);

  if (!primaryActionPlan) {
    return;
  }

  await runPrimaryActionPlan(primaryActionPlan);
}

function handleTraitToggle(traitCode: string, isChecked: boolean): void {
  // Mantenemos los rasgos elegidos en estado local de UI porque no pertenecen al aggregate.
  if (isChecked) {
    webAdapterState.selectedTraitCodes.add(traitCode);
  } else {
    webAdapterState.selectedTraitCodes.delete(traitCode);
  }

  persistCurrentWebAdapterState();
}

async function runPrimaryActionPlan(
  primaryActionPlan: ReturnType<typeof resolvePrimaryActionPlan>
): Promise<void> {
  if (!primaryActionPlan) {
    return;
  }

  switch (primaryActionPlan.kind) {
    case "start_case":
      await startCaseFromSeed();
      return;
    case "visit_location":
      if (primaryActionPlan.locationId) {
        await visitLocation(primaryActionPlan.locationId);
      }
      return;
    case "travel_to_city":
      if (primaryActionPlan.destinationCityId) {
        await travelToCity(primaryActionPlan.destinationCityId);
      }
      return;
    case "submit_warrant":
      await submitWarrant();
      return;
    case "attempt_arrest":
      await attemptArrest();
  }
}

async function runUiAction(action: () => Promise<void>): Promise<void> {
  try {
    clearFeedbackBanner();
    await action();
  } catch (error: unknown) {
    setFeedbackBanner(
      "error",
      error instanceof Error ? error.message : "Unknown web adapter error."
    );
  } finally {
    renderApplication();
  }
}

async function useDemoSeed(): Promise<void> {
  webAdapterState.seed = DEMO_CASE_SEED;
  setFeedbackBanner(
    "info",
    `Loaded the tutorial seed ${DEMO_CASE_SEED}. Start a new case when you want a stable walkthrough.`
  );
}

async function generateFreshSeed(): Promise<void> {
  const freshSeed = createFreshCaseSeed();
  webAdapterState.seed = freshSeed;
  setFeedbackBanner(
    "info",
    `Generated a fresh reproducible seed: ${freshSeed}.`
  );
}

function createCurrentInvestigationReport(): string {
  return createInvestigationReport({
    seed: normalizeSeedInput(webAdapterState.seed, DEMO_CASE_SEED),
    caseStatusView: webAdapterState.currentCaseStatusView,
    publishedEvents: webAdapterState.session.eventBus.publishedEvents,
    recordedTelemetryEntries: webAdapterState.session.telemetry.recordedEntries,
    feedbackMessage: webAdapterState.feedbackBanner?.message ?? null
  });
}

function sanitizeFileNameSegment(rawValue: string): string {
  return rawValue
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "case";
}

function createInvestigationReportFileName(): string {
  const caseStatusView = webAdapterState.currentCaseStatusView;
  const reportIdentifier =
    caseStatusView?.caseId ??
    normalizeSeedInput(webAdapterState.seed, DEMO_CASE_SEED);

  return `cipher-investigation-${sanitizeFileNameSegment(reportIdentifier)}.txt`;
}

function triggerReportDownload(fileName: string, fileContents: string): void {
  const reportFileBlob = new Blob([fileContents], {
    type: "text/plain;charset=utf-8"
  });
  const reportFileUrl = URL.createObjectURL(reportFileBlob);
  const downloadLinkElement = document.createElement("a");

  downloadLinkElement.href = reportFileUrl;
  downloadLinkElement.download = fileName;
  document.body.append(downloadLinkElement);
  downloadLinkElement.click();
  downloadLinkElement.remove();
  URL.revokeObjectURL(reportFileUrl);
}

async function copyInvestigationReport(): Promise<void> {
  const reportContents = createCurrentInvestigationReport();

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(reportContents);
      setFeedbackBanner("success", "Copied the investigation report to the clipboard.");
      return;
    } catch {
      // Si el navegador niega clipboard, degradamos a descarga local para no perder la accion.
    }
  }

  triggerReportDownload(createInvestigationReportFileName(), reportContents);
  setFeedbackBanner(
    "info",
    "Clipboard access was unavailable. Downloaded the report instead."
  );
}

async function downloadInvestigationReport(): Promise<void> {
  triggerReportDownload(
    createInvestigationReportFileName(),
    createCurrentInvestigationReport()
  );
  setFeedbackBanner("success", "Downloaded the current investigation report.");
}

async function toggleFullscreen(): Promise<void> {
  if (!document.documentElement.requestFullscreen) {
    throw new Error("This browser does not support fullscreen mode.");
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    setFeedbackBanner("info", "Exited fullscreen mode.");
    return;
  }

  await document.documentElement.requestFullscreen();
  setFeedbackBanner("info", "Entered fullscreen mode for the dossier.");
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  // Si el foco esta en un input de texto, dejamos que el navegador maneje la escritura.
  if (event.target instanceof HTMLInputElement && event.key !== "Enter") {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    void runUiAction(runPrimaryKeyboardAction);
    return;
  }

  if (event.key.toLowerCase() === "a" && webAdapterState.currentCaseStatusView) {
    event.preventDefault();

    const allTraitCodes = webAdapterState.currentCaseStatusView.discoveredTraits.map(
      (trait) => trait.code
    );
    const areAllTraitsSelected =
      allTraitCodes.length > 0 &&
      allTraitCodes.every((traitCode) => webAdapterState.selectedTraitCodes.has(traitCode));

    webAdapterState.selectedTraitCodes = areAllTraitsSelected
      ? new Set()
      : new Set(allTraitCodes);
    renderApplication();
    return;
  }

  if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    void runUiAction(resetBrowserSession);
    return;
  }

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    void runUiAction(toggleFullscreen);
  }
}

function renderApplication(): void {
  applicationRootElement.innerHTML = createApplicationMarkup();
  bindApplicationEvents();
  persistCurrentWebAdapterState();
}

function createHeroMarkup(): string {
  const caseStatusView = webAdapterState.currentCaseStatusView;
  const fullscreenButtonLabel = document.fullscreenElement
    ? "Exit Fullscreen"
    : "Fullscreen";

  return `
    <section class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">Cipher Web Adapter</p>
          <h1>Investigate the case from the browser.</h1>
          <p class="hero-copy">
            This local-first web surface runs the same application use cases as the CLI while adding a
            readable dossier, progress guidance and exportable investigation reports.
          </p>
          <div class="seed-row">
            <input
              id="seed-input"
              class="seed-input"
              type="text"
              value="${escapeHtml(webAdapterState.seed)}"
              placeholder="Enter a case seed"
              aria-label="Case seed"
            />
            <button id="start-case-button" class="action-button">Start Case</button>
          </div>
          <div class="seed-actions">
            <button id="use-demo-seed-button" class="action-button ghost">Use Demo Seed</button>
            <button id="generate-seed-button" class="action-button ghost">Generate Seed</button>
            <button id="restart-case-button" class="action-button ghost">Reset Session</button>
            <button id="toggle-fullscreen-button" class="action-button ghost">${fullscreenButtonLabel}</button>
          </div>
        </div>
        <aside class="hero-dossier">
          <p class="log-label">Adapter briefing</p>
          <div class="briefing-grid">
            <article class="briefing-item">
              <span class="metric-label">UI state</span>
              <strong>${escapeHtml(caseStatusView?.state ?? "Briefing")}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Persistence</span>
              <strong>localStorage</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Active dossier</span>
              <strong>${escapeHtml(caseStatusView?.caseId ?? "No active case")}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Architecture trace</span>
              <strong>${webAdapterState.session.eventBus.publishedEvents.length} events / ${webAdapterState.session.telemetry.recordedEntries.length} telemetry</strong>
            </article>
          </div>
          <p class="hero-note">
            Reloading the page restores the active case, the visible event trace and the warrant selection state.
          </p>
        </aside>
      </div>
    </section>
  `;
}

function createFeedbackBannerMarkup(): string {
  if (!webAdapterState.feedbackBanner) {
    return "";
  }

  return `
    <div class="feedback-banner feedback-banner--${escapeHtml(webAdapterState.feedbackBanner.kind)}" role="status">
      ${escapeHtml(webAdapterState.feedbackBanner.message)}
    </div>
  `;
}

function createProgressMarkup(
  progressSnapshot: ReturnType<typeof deriveCaseProgressSnapshot>
): string {
  return `
    <div class="progress-block">
      <div class="card-header">
        <p class="log-label">Case progress</p>
        <span class="chip active">${progressSnapshot.completionPercent}%</span>
      </div>
      <h3 class="section-title">${escapeHtml(progressSnapshot.stageLabel)}</h3>
      <div class="progress-bar" aria-hidden="true">
        <span class="progress-fill" style="width: ${progressSnapshot.completionPercent}%;"></span>
      </div>
      <p class="progress-caption">${escapeHtml(progressSnapshot.summary)}</p>
    </div>
  `;
}

function createMilestonesMarkup(
  progressSnapshot: ReturnType<typeof deriveCaseProgressSnapshot>
): string {
  return `
    <div class="milestone-list">
      ${progressSnapshot.milestones
        .map(
          (milestone) => `
            <article class="milestone-item ${milestone.isReached ? "reached" : ""}">
              <span class="milestone-state">${milestone.isReached ? "Reached" : "Pending"}</span>
              <div class="milestone-detail">
                <strong>${escapeHtml(milestone.label)}</strong>
                <p class="muted">${escapeHtml(milestone.detail)}</p>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function createReportPanelMarkup(): string {
  const reportPreview = createCurrentInvestigationReport()
    .split("\n")
    .slice(0, 16)
    .join("\n");

  return `
    <section class="panel">
      <div class="card-header">
        <div>
          <h3 class="section-title">Investigation Report</h3>
          <p class="panel-subtitle">Export the current dossier as plain text for demos, notes or review.</p>
        </div>
        <span class="chip">${escapeHtml(createInvestigationReportFileName())}</span>
      </div>
      <div class="report-actions">
        <button id="copy-report-button" class="action-button secondary">Copy Report</button>
        <button id="download-report-button" class="action-button ghost">Download Report</button>
      </div>
      <pre class="report-preview">${escapeHtml(reportPreview)}</pre>
    </section>
  `;
}

function createArchitectureTraceMarkup(caseStatusView: CaseStatusView | null): string {
  return `
    <section class="panel">
      <h3 class="section-title">Architecture Trace</h3>
      <div class="log-list">
        <article class="log-card">
          <p class="log-label">Published domain events</p>
          <p class="metric-value">${webAdapterState.session.eventBus.publishedEvents.length}</p>
          <p class="muted">
            ${escapeHtml(webAdapterState.session.eventBus.publishedEvents.at(-1)?.type ?? "No events yet.")}
          </p>
        </article>
        <article class="log-card">
          <p class="log-label">Recorded telemetry entries</p>
          <p class="metric-value">${webAdapterState.session.telemetry.recordedEntries.length}</p>
          <p class="muted">
            ${escapeHtml(webAdapterState.session.telemetry.recordedEntries.at(-1)?.eventName ?? "No telemetry yet.")}
          </p>
        </article>
        <article class="log-card">
          <p class="log-label">Browser storage</p>
          <p class="metric-value">localStorage</p>
          <p class="muted">
            Reloads rehydrate the active case and the visible trace from a local snapshot.
          </p>
        </article>
        <article class="log-card">
          <p class="log-label">Travel history</p>
          ${
            caseStatusView === null || caseStatusView.travelHistory.length === 0
              ? `<p class="muted">No travel recorded yet.</p>`
              : caseStatusView.travelHistory
                  .map(
                    (travelEntry) =>
                      `<p>${escapeHtml(travelEntry.fromCityName)} -> ${escapeHtml(travelEntry.toCityName)} (${travelEntry.travelTimeHours}h)</p>`
                  )
                  .join("")
          }
        </article>
      </div>
    </section>
  `;
}

function createEmptyStateMarkup(
  progressSnapshot: ReturnType<typeof deriveCaseProgressSnapshot>,
  recommendedActionCopy: ReturnType<typeof deriveRecommendedActionCopy>,
  primaryActionPlan: ReturnType<typeof resolvePrimaryActionPlan>
): string {
  return `
    <section class="layout intro-layout">
      <div class="stack">
        <section class="panel">
          ${createProgressMarkup(progressSnapshot)}
          <div class="recommendation-card">
            <p class="log-label">Mission control</p>
            <h3 class="recommendation-title">${escapeHtml(recommendedActionCopy.title)}</h3>
            <p class="panel-subtitle">${escapeHtml(recommendedActionCopy.description)}</p>
            ${
              primaryActionPlan
                ? `<button id="recommended-action-button" class="action-button">${escapeHtml(primaryActionPlan.label)}</button>`
                : ""
            }
          </div>
        </section>

        <section class="panel empty-state">
          <h2 class="panel-title">No Case Open Yet</h2>
          <p class="muted">
            Start from <strong>${escapeHtml(normalizeSeedInput(webAdapterState.seed, DEMO_CASE_SEED))}</strong> to generate a reproducible dossier.
          </p>
          <p class="footer-note">
            The browser adapter is intentionally local-first: it persists the active case in <strong>localStorage</strong>
            while the CLI continues to demonstrate the heavier <strong>SQLite</strong> path.
          </p>
          ${createMilestonesMarkup(progressSnapshot)}
        </section>
      </div>

      <aside class="stack">
        ${createReportPanelMarkup()}
        ${createArchitectureTraceMarkup(null)}
      </aside>
    </section>
  `;
}

function createActiveCaseMarkup(
  caseStatusView: CaseStatusView,
  selectedTraitCodes: Set<string>,
  progressSnapshot: ReturnType<typeof deriveCaseProgressSnapshot>,
  recommendedActionCopy: ReturnType<typeof deriveRecommendedActionCopy>,
  primaryActionPlan: ReturnType<typeof resolvePrimaryActionPlan>
): string {
  const hasIssuedWarrant = caseStatusView.issuedWarrant !== null;
  const canAttemptArrest = caseStatusView.state === "Chase";

  return `
    <section class="layout">
      <div class="stack">
        <section class="panel status-panel">
          <span class="chip active">${escapeHtml(caseStatusView.state)}</span>
          <h2 class="status-headline">${escapeHtml(caseStatusView.headline)}</h2>
          <p class="panel-subtitle">${escapeHtml(caseStatusView.timePressureMessage)}</p>
          ${createProgressMarkup(progressSnapshot)}
          <div class="metrics">
            <article class="metric-card">
              <span class="metric-label">Case ID</span>
              <span class="metric-value">${escapeHtml(caseStatusView.caseId)}</span>
            </article>
            <article class="metric-card">
              <span class="metric-label">Current city</span>
              <span class="metric-value">${escapeHtml(caseStatusView.currentCityName)}</span>
            </article>
            <article class="metric-card">
              <span class="metric-label">Remaining time</span>
              <span class="metric-value">${caseStatusView.remainingTimeHours}h</span>
            </article>
            <article class="metric-card">
              <span class="metric-label">Artifact</span>
              <span class="metric-value">${escapeHtml(caseStatusView.artifactName)}</span>
            </article>
          </div>
          ${
            caseStatusView.resolution
              ? `
                  <article class="resolution-card ${caseStatusView.resolution.outcome === "Arrested" ? "success" : "danger"}">
                    <p class="log-label">Final outcome</p>
                    <strong>${escapeHtml(caseStatusView.resolution.outcome)}</strong>
                    <p class="muted">${escapeHtml(caseStatusView.resolution.summary)}</p>
                  </article>
                `
              : ""
          }
        </section>

        <section class="panel">
          <h3 class="section-title">Case Briefing</h3>
          <div class="briefing-grid">
            <article class="briefing-item">
              <span class="metric-label">Seed</span>
              <strong>${escapeHtml(normalizeSeedInput(webAdapterState.seed, DEMO_CASE_SEED))}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Agent</span>
              <strong>${escapeHtml(caseStatusView.agentName)}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Agency</span>
              <strong>${escapeHtml(caseStatusView.agencyName)}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Target</span>
              <strong>${escapeHtml(caseStatusView.targetAlias)}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Artifact</span>
              <strong>${escapeHtml(caseStatusView.artifactName)}</strong>
            </article>
            <article class="briefing-item">
              <span class="metric-label">Origin</span>
              <strong>${escapeHtml(caseStatusView.artifactOrigin)}</strong>
            </article>
          </div>
        </section>

        <section class="panel">
          <h3 class="section-title">Locations</h3>
          <div class="card-grid">
            ${caseStatusView.availableLocations
              .map(
                (location) => `
                  <article class="clue-card ${location.isVisited ? "visited" : ""}">
                    <div class="card-header">
                      <h4 class="card-title">${escapeHtml(location.name)}</h4>
                      <span class="chip ${location.isVisited ? "visited" : "pending"}">
                        ${location.isVisited ? "Visited" : "Pending"}
                      </span>
                    </div>
                    <p class="panel-subtitle">
                      ${escapeHtml(location.clueSummary ?? "Clue hidden until this location is visited.")}
                    </p>
                    ${
                      !location.isVisited && caseStatusView.state === "Investigating"
                        ? `<button class="action-button secondary" data-visit-location-id="${escapeHtml(location.id)}">Visit Location</button>`
                        : ""
                    }
                  </article>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="panel">
          <h3 class="section-title">Route Evidence and Travel</h3>
          <div class="card-grid">
            ${
              caseStatusView.availableTravelDestinations.length === 0
                ? `<article class="action-card"><p class="muted">No known travel route is available from this city yet.</p></article>`
                : caseStatusView.availableTravelDestinations
                    .map(
                      (destination) => `
                        <article class="action-card">
                          <div class="card-header">
                            <h4 class="card-title">${escapeHtml(destination.name)}</h4>
                            <span class="chip">${destination.travelTimeHours}h</span>
                          </div>
                          <p class="panel-subtitle">
                            Travel is only possible because this destination is already visible to the player.
                          </p>
                          <button class="action-button" data-travel-city-id="${escapeHtml(destination.id)}">Travel There</button>
                        </article>
                      `
                    )
                    .join("")
            }
          </div>
        </section>
      </div>

      <aside class="stack">
        <section class="panel">
          <p class="log-label">Mission control</p>
          <h3 class="recommendation-title">${escapeHtml(recommendedActionCopy.title)}</h3>
          <p class="panel-subtitle">${escapeHtml(recommendedActionCopy.description)}</p>
          ${
            primaryActionPlan
              ? `<button id="recommended-action-button" class="action-button">${escapeHtml(primaryActionPlan.label)}</button>`
              : ""
          }
          ${createMilestonesMarkup(progressSnapshot)}
        </section>

        <section class="panel">
          <h3 class="section-title">Discovered Trait Evidence</h3>
          ${
            caseStatusView.discoveredTraits.length === 0
              ? `<p class="muted">No trait clue has been discovered yet.</p>`
              : `
                  <div class="trait-list">
                    ${caseStatusView.discoveredTraits
                      .map(
                        (trait) => `
                          <label class="trait-toggle">
                            <input
                              class="trait-checkbox"
                              type="checkbox"
                              data-trait-code="${escapeHtml(trait.code)}"
                              ${selectedTraitCodes.has(trait.code) ? "checked" : ""}
                            />
                            <span>${escapeHtml(trait.label)}</span>
                          </label>
                        `
                      )
                      .join("")}
                  </div>
                `
          }
          <div class="inline-actions">
            <button
              id="submit-warrant-button"
              class="action-button secondary"
              ${caseStatusView.state !== "Investigating" || caseStatusView.discoveredTraits.length === 0 || hasIssuedWarrant ? "disabled" : ""}
            >
              Submit Warrant
            </button>
            <button
              id="attempt-arrest-button"
              class="action-button danger"
              ${canAttemptArrest ? "" : "disabled"}
            >
              Attempt Arrest
            </button>
          </div>
          ${
            caseStatusView.issuedWarrant
              ? `
                  <p class="log-label">Issued warrant</p>
                  <div class="tag-list">
                    ${caseStatusView.issuedWarrant.suspectedTraits
                      .map((trait) => `<span class="tag">${escapeHtml(trait.label)}</span>`)
                      .join("")}
                  </div>
                `
              : ""
          }
        </section>

        <section class="panel">
          <h3 class="section-title">Collected Clues</h3>
          <div class="log-list">
            ${
              caseStatusView.collectedClues.length === 0
                ? `<div class="log-card"><p class="muted">No clue has been collected yet.</p></div>`
                : caseStatusView.collectedClues
                    .map((clue) => `<article class="log-card">${escapeHtml(clue)}</article>`)
                    .join("")
            }
          </div>
        </section>

        ${createReportPanelMarkup()}
        ${createArchitectureTraceMarkup(caseStatusView)}
      </aside>
    </section>
  `;
}

/**
 * Este helper convierte el estado web en HTML.
 * Usamos una proyeccion declarativa sencilla para que el adapter siga siendo didactico sin framework.
 */
function createApplicationMarkup(): string {
  const caseStatusView = webAdapterState.currentCaseStatusView;
  const progressSnapshot = deriveCaseProgressSnapshot(caseStatusView);
  const primaryActionPlan = resolvePrimaryActionPlan(caseStatusView);
  const recommendedActionCopy = deriveRecommendedActionCopy(
    caseStatusView,
    primaryActionPlan
  );

  return `
    <main class="page">
      ${createHeroMarkup()}
      ${createFeedbackBannerMarkup()}
      ${
        caseStatusView === null
          ? createEmptyStateMarkup(
              progressSnapshot,
              recommendedActionCopy,
              primaryActionPlan
            )
          : createActiveCaseMarkup(
              caseStatusView,
              webAdapterState.selectedTraitCodes,
              progressSnapshot,
              recommendedActionCopy,
              primaryActionPlan
            )
      }
      <p class="footer-note">
        Keyboard: <strong>Enter</strong> advances the recommended step, <strong>A</strong> toggles all discovered warrant traits,
        <strong>B</strong> resets the browser session and <strong>F</strong> toggles fullscreen.
      </p>
    </main>
  `;
}

function bindApplicationEvents(): void {
  const seedInputElement =
    applicationRootElement.querySelector<HTMLInputElement>("#seed-input");
  const startCaseButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#start-case-button");
  const useDemoSeedButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#use-demo-seed-button");
  const generateSeedButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#generate-seed-button");
  const restartCaseButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#restart-case-button");
  const toggleFullscreenButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#toggle-fullscreen-button");
  const recommendedActionButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#recommended-action-button");
  const copyReportButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#copy-report-button");
  const downloadReportButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#download-report-button");
  const submitWarrantButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#submit-warrant-button");
  const attemptArrestButtonElement =
    applicationRootElement.querySelector<HTMLButtonElement>("#attempt-arrest-button");

  seedInputElement?.addEventListener("input", (event) => {
    const nextSeed = (event.currentTarget as HTMLInputElement).value;
    webAdapterState.seed = nextSeed;
    persistCurrentWebAdapterState();
    window.render_game_to_text = renderGameToText;
  });

  startCaseButtonElement?.addEventListener("click", () => {
    void runUiAction(startCaseFromSeed);
  });

  useDemoSeedButtonElement?.addEventListener("click", () => {
    void runUiAction(useDemoSeed);
  });

  generateSeedButtonElement?.addEventListener("click", () => {
    void runUiAction(generateFreshSeed);
  });

  restartCaseButtonElement?.addEventListener("click", () => {
    void runUiAction(resetBrowserSession);
  });

  toggleFullscreenButtonElement?.addEventListener("click", () => {
    void runUiAction(toggleFullscreen);
  });

  recommendedActionButtonElement?.addEventListener("click", () => {
    void runUiAction(runPrimaryKeyboardAction);
  });

  copyReportButtonElement?.addEventListener("click", () => {
    void runUiAction(copyInvestigationReport);
  });

  downloadReportButtonElement?.addEventListener("click", () => {
    void runUiAction(downloadInvestigationReport);
  });

  applicationRootElement
    .querySelectorAll<HTMLButtonElement>("[data-visit-location-id]")
    .forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        const locationId = buttonElement.dataset.visitLocationId;

        if (!locationId) {
          return;
        }

        void runUiAction(async () => {
          await visitLocation(locationId);
        });
      });
    });

  applicationRootElement
    .querySelectorAll<HTMLButtonElement>("[data-travel-city-id]")
    .forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        const destinationCityId = buttonElement.dataset.travelCityId;

        if (!destinationCityId) {
          return;
        }

        void runUiAction(async () => {
          await travelToCity(destinationCityId);
        });
      });
    });

  applicationRootElement
    .querySelectorAll<HTMLInputElement>("[data-trait-code]")
    .forEach((checkboxElement) => {
      checkboxElement.addEventListener("change", () => {
        const traitCode = checkboxElement.dataset.traitCode;

        if (!traitCode) {
          return;
        }

        handleTraitToggle(traitCode, checkboxElement.checked);
      });
    });

  submitWarrantButtonElement?.addEventListener("click", () => {
    void runUiAction(submitWarrant);
  });

  attemptArrestButtonElement?.addEventListener("click", () => {
    void runUiAction(attemptArrest);
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRequiredApplicationRootElement(): HTMLDivElement {
  const resolvedApplicationRootElement = document.querySelector<HTMLDivElement>("#app");

  if (!resolvedApplicationRootElement) {
    throw new Error("The web adapter requires a root #app element.");
  }

  return resolvedApplicationRootElement;
}

function resolveBrowserStorage(): BrowserKeyValueStore {
  return window.localStorage;
}

document.addEventListener("keydown", handleGlobalKeydown);
document.addEventListener("fullscreenchange", renderApplication);

void (async () => {
  webAdapterState = await createInitialWebAdapterState();
  renderApplication();
})();
