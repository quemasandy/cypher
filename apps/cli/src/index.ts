/**
 * Este archivo implementa el adapter principal de la CLI.
 * Su responsabilidad es traducir comandos de terminal a casos de uso de aplicacion,
 * manteniendo dos modos complementarios: demo automatica y sesion persistida por pasos.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CaseRepository } from "@cipher/contracts";
import type { Case } from "@cipher/domain";
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
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry,
  ProceduralCaseGenerator,
  SQLiteCaseRepository
} from "@cipher/infra";
import {
  CliCommand,
  createCliHelpText,
  parseCliArguments,
  type ParsedCliArguments
} from "./cli-arguments.js";

type CliCaseRepository = CaseRepository<Case> & {
  close?: () => Promise<void>;
};

interface CliRuntimeContext {
  caseRepository: CliCaseRepository;
  storageDescription: string;
  eventBus: InMemoryEventBus;
  telemetry: InMemoryTelemetry;
  startCase: StartCase;
  getCaseStatus: GetCaseStatus;
  visitLocation: VisitLocation;
  travelToCity: TravelToCity;
  submitWarrant: SubmitWarrant;
  attemptArrest: AttemptArrest;
}

/**
 * Este helper imprime una vista amigable del caso para la terminal.
 * La CLI muestra siempre `caseId` y storage para hacer visible que la sesion puede persistirse.
 */
function printCaseStatus(
  title: string,
  caseStatusView: CaseStatusView,
  storageDescription: string
): void {
  // Imprimimos una separacion visual para que la salida sea mas facil de leer.
  console.log(`=== ${title} ===`);

  // Mostramos metadatos tecnicos basicos de la sesion antes del resumen narrativo.
  console.log(`Case ID: ${caseStatusView.caseId}`);
  console.log(`Storage: ${storageDescription}`);

  // Imprimimos el resumen principal del caso.
  console.log(caseStatusView.headline);

  // Imprimimos la presion de tiempo que define el loop del juego.
  console.log(caseStatusView.timePressureMessage);

  // Mostramos datos clave del contexto actual del caso.
  console.log(`State: ${caseStatusView.state}`);
  console.log(`Current city: ${caseStatusView.currentCityName}`);
  console.log(`Artifact: ${caseStatusView.artifactName}`);

  // Mostramos solo la evidencia de rasgos realmente descubierta por el jugador.
  if (caseStatusView.discoveredTraitLabels.length === 0) {
    console.log("Discovered trait evidence: none yet.");
  } else {
    console.log(`Discovered trait evidence: ${caseStatusView.discoveredTraitLabels.join(", ")}`);
  }

  // Mostramos la warrant emitida si el jugador ya comprometio una hipotesis.
  if (caseStatusView.issuedWarrant === null) {
    console.log("Issued warrant: none yet.");
  } else {
    console.log(
      `Issued warrant: ${caseStatusView.issuedWarrant.suspectedTraits.map((trait) => trait.label).join(", ")}`
    );
  }

  // Mostramos la resolucion final si el caso ya termino.
  if (caseStatusView.resolution === null) {
    console.log("Resolution: case still active.");
  } else {
    console.log(
      `Resolution: ${caseStatusView.resolution.outcome} (${caseStatusView.resolution.cause})`
    );
    console.log(`Resolution summary: ${caseStatusView.resolution.summary}`);
  }

  console.log("Locations in current city:");

  // Recorremos las locaciones disponibles para mostrar la informacion inmediata del jugador.
  for (const location of caseStatusView.availableLocations) {
    // Mostramos si la locacion ya fue investigada y solo revelamos pistas cuando corresponde.
    const clueSummary =
      location.clueSummary ?? "Clue hidden until this location is visited.";
    const visitStatus = location.isVisited ? "visited" : "pending";
    console.log(`- [${visitStatus}] ${location.name}: ${clueSummary}`);
  }

  // Mostramos el historial de pistas reveladas para que el jugador vea progreso real.
  if (caseStatusView.collectedClues.length === 0) {
    console.log("Collected clues: none yet.");
  } else {
    console.log("Collected clues:");

    for (const clue of caseStatusView.collectedClues) {
      console.log(`- ${clue}`);
    }
  }

  // Mostramos los destinos de viaje conocidos desde la ciudad actual.
  if (caseStatusView.availableTravelDestinations.length === 0) {
    console.log("Travel options: none from this city.");
  } else {
    console.log("Travel options:");

    for (const destination of caseStatusView.availableTravelDestinations) {
      console.log(`- ${destination.name} (${destination.travelTimeHours}h)`);
    }
  }

  // Mostramos el historial de desplazamientos para que el progreso geografico sea visible.
  if (caseStatusView.travelHistory.length === 0) {
    console.log("Travel history: none yet.");
  } else {
    console.log("Travel history:");

    for (const travelEntry of caseStatusView.travelHistory) {
      console.log(
        `- ${travelEntry.fromCityName} -> ${travelEntry.toCityName} (${travelEntry.travelTimeHours}h)`
      );
    }
  }
}

/**
 * Este helper imprime el rastro tecnico de una invocacion mutante de la CLI.
 * Mantenerlo visible ayuda a conectar el adapter con eventos y telemetria en modo didactico.
 */
function printSideEffectSummary(cliRuntimeContext: CliRuntimeContext): void {
  console.log(`Published domain events: ${cliRuntimeContext.eventBus.publishedEvents.length}`);
  console.log(`Recorded telemetry entries: ${cliRuntimeContext.telemetry.recordedEntries.length}`);
}

/**
 * Este helper selecciona los rasgos que compondran la warrant.
 * En modo no interactivo usa todos los rasgos disponibles para que la demo y los comandos sigan siendo automatizables.
 */
async function chooseTraitsForWarrant(
  caseStatusView: CaseStatusView
): Promise<CaseStatusView["discoveredTraits"] | null> {
  // Solo tiene sentido emitir warrant si el caso sigue en investigacion.
  if (caseStatusView.state !== "Investigating") {
    return null;
  }

  // Si no hay rasgos disponibles, no podemos construir una hipotesis legal.
  if (caseStatusView.discoveredTraits.length === 0) {
    return null;
  }

  // En entornos sin TTY tomamos todos los rasgos para mantener una demo automatizable.
  if (!input.isTTY || !output.isTTY) {
    return [...caseStatusView.discoveredTraits];
  }

  // Creamos una interfaz puntual para leer una eleccion del jugador.
  const readlineInterface = createInterface({ input, output });

  try {
    console.log("Choose the traits to include in the warrant:");

    for (const [index, trait] of caseStatusView.discoveredTraits.entries()) {
      console.log(`${index + 1}. ${trait.label}`);
    }

    // Pedimos una lista separada por comas para no bloquear el soporte a warrants con varios rasgos.
    const rawAnswer = await readlineInterface.question("Trait numbers (comma-separated): ");
    const selectedIndexes = Array.from(
      new Set(
        rawAnswer
          .split(",")
          .map((answerChunk) => Number.parseInt(answerChunk.trim(), 10) - 1)
          .filter(
            (candidateIndex) =>
              Number.isInteger(candidateIndex) &&
              candidateIndex >= 0 &&
              candidateIndex < caseStatusView.discoveredTraits.length
          )
      )
    );

    // Si la entrada no es valida, degradamos a todos los rasgos disponibles para no romper la demo.
    if (selectedIndexes.length === 0) {
      console.log("Invalid selection. All listed traits will be used in the warrant.");
      return [...caseStatusView.discoveredTraits];
    }

    // Devolvemos solo los rasgos elegidos por el jugador.
    return selectedIndexes.map((selectedIndex) => caseStatusView.discoveredTraits[selectedIndex]);
  } finally {
    // Cerramos la interfaz para liberar stdin/stdout correctamente.
    readlineInterface.close();
  }
}

/**
 * Este helper recorre locaciones hasta alcanzar una cantidad minima de rasgos descubiertos.
 * La demo lo usa para que la warrant se base en evidencia visible y no en informacion oculta.
 */
async function collectTraitEvidenceUntil(
  visitLocation: VisitLocation,
  caseStatusView: CaseStatusView,
  minimumDiscoveredTraitCount: number,
  titlePrefix: string,
  storageDescription: string
): Promise<CaseStatusView> {
  let currentCaseStatusView = caseStatusView;

  // Seguimos inspeccionando mientras falte evidencia y el caso siga en investigacion activa.
  while (
    currentCaseStatusView.state === "Investigating" &&
    currentCaseStatusView.discoveredTraits.length < minimumDiscoveredTraitCount
  ) {
    const selectedLocationId = await chooseLocationToVisit(currentCaseStatusView);

    if (!selectedLocationId) {
      return currentCaseStatusView;
    }

    currentCaseStatusView = await visitLocation.execute({
      caseId: currentCaseStatusView.caseId,
      locationId: selectedLocationId
    });

    console.log("");
    printCaseStatus(
      `${titlePrefix} (${currentCaseStatusView.discoveredTraits.length}/${minimumDiscoveredTraitCount} trait clues)`,
      currentCaseStatusView,
      storageDescription
    );
  }

  return currentCaseStatusView;
}

/**
 * Este helper selecciona una locacion a visitar.
 * En modo no interactivo elige la primera pendiente para mantener la CLI automatizable.
 */
async function chooseLocationToVisit(caseStatusView: CaseStatusView): Promise<string | null> {
  // Solo tiene sentido pedir seleccion si queda al menos una locacion sin visitar.
  const pendingLocations = caseStatusView.availableLocations.filter(
    (location: CaseStatusView["availableLocations"][number]) => !location.isVisited
  );

  // Si no quedan opciones, devolvemos `null` para que la CLI cierre el flujo sin preguntar.
  if (pendingLocations.length === 0) {
    return null;
  }

  // En entornos sin TTY resolvemos automaticamente la primera opcion pendiente.
  if (!input.isTTY || !output.isTTY) {
    return pendingLocations[0].id;
  }

  // Creamos una interfaz puntual para leer una eleccion del jugador.
  const readlineInterface = createInterface({ input, output });

  try {
    console.log("Choose a location to inspect:");

    for (const [index, location] of pendingLocations.entries()) {
      console.log(`${index + 1}. ${location.name}`);
    }

    // Pedimos el numero de opcion para mantener el flujo legible en terminal.
    const rawAnswer = await readlineInterface.question("Location number: ");
    const selectedIndex = Number.parseInt(rawAnswer.trim(), 10) - 1;

    // Si la entrada no es valida, degradamos a la primera opcion para no romper la CLI.
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= pendingLocations.length) {
      console.log("Invalid selection. The first pending location will be inspected.");
      return pendingLocations[0].id;
    }

    // Devolvemos la locacion elegida por el jugador.
    return pendingLocations[selectedIndex].id;
  } finally {
    // Cerramos la interfaz para liberar stdin/stdout correctamente.
    readlineInterface.close();
  }
}

/**
 * Este helper selecciona una ciudad destino a la que viajar.
 * En modo no interactivo elige la primera conexion disponible para mantener la CLI automatizable.
 */
async function chooseDestinationCity(caseStatusView: CaseStatusView): Promise<string | null> {
  // Si no hay conexiones salientes conocidas, no tiene sentido pedir una decision de viaje.
  if (caseStatusView.availableTravelDestinations.length === 0) {
    return null;
  }

  // En entornos sin TTY resolvemos automaticamente la primera opcion disponible.
  if (!input.isTTY || !output.isTTY) {
    return caseStatusView.availableTravelDestinations[0].id;
  }

  // Creamos una interfaz puntual para leer una eleccion del jugador.
  const readlineInterface = createInterface({ input, output });

  try {
    console.log("Choose a city to travel to:");

    for (const [index, destination] of caseStatusView.availableTravelDestinations.entries()) {
      console.log(`${index + 1}. ${destination.name} (${destination.travelTimeHours}h)`);
    }

    // Pedimos el numero de opcion para mantener el flujo legible en terminal.
    const rawAnswer = await readlineInterface.question("City number: ");
    const selectedIndex = Number.parseInt(rawAnswer.trim(), 10) - 1;

    // Si la entrada no es valida, degradamos a la primera opcion para no romper la CLI.
    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= caseStatusView.availableTravelDestinations.length
    ) {
      console.log("Invalid selection. The first connected city will be used.");
      return caseStatusView.availableTravelDestinations[0].id;
    }

    // Devolvemos la ciudad elegida por el jugador.
    return caseStatusView.availableTravelDestinations[selectedIndex].id;
  } finally {
    // Cerramos la interfaz para liberar stdin/stdout correctamente.
    readlineInterface.close();
  }
}

/**
 * Este helper crea el runtime comun de la CLI a partir del comando elegido.
 * El mismo adapter puede funcionar sobre memoria o sobre `SQLite` sin cambiar casos de uso.
 */
function createCliRuntimeContext(parsedCliArguments: ParsedCliArguments): CliRuntimeContext {
  const caseRepository = createCaseRepository(parsedCliArguments);
  const storageDescription = parsedCliArguments.usePersistentStorage
    ? `SQLite (${parsedCliArguments.databaseFilePath})`
    : "InMemory (ephemeral)";
  const eventBus = new InMemoryEventBus();
  const telemetry = new InMemoryTelemetry();
  const caseGenerator = new ProceduralCaseGenerator();

  return {
    caseRepository,
    storageDescription,
    eventBus,
    telemetry,
    startCase: new StartCase({
      caseGenerator,
      caseRepository,
      eventBus,
      telemetry
    }),
    getCaseStatus: new GetCaseStatus({
      caseRepository
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

function createCaseRepository(parsedCliArguments: ParsedCliArguments): CliCaseRepository {
  if (!parsedCliArguments.usePersistentStorage) {
    return new InMemoryCaseRepository();
  }

  if (!parsedCliArguments.databaseFilePath) {
    throw new Error("Persistent CLI mode requires a database file path.");
  }

  return new SQLiteCaseRepository({
    databaseFilePath: parsedCliArguments.databaseFilePath
  });
}

async function closeCliRuntimeContext(cliRuntimeContext: CliRuntimeContext): Promise<void> {
  await cliRuntimeContext.caseRepository.close?.();
}

/**
 * Este helper ejecuta el demo automatico que ya existia antes de la sesion persistida.
 */
async function runDemoWorkflow(
  cliRuntimeContext: CliRuntimeContext,
  selectedSeed: string
): Promise<void> {
  // Ejecutamos el caso de uso de inicio usando una `seed` reproducible.
  const openedCaseStatusView = await cliRuntimeContext.startCase.execute({
    seed: selectedSeed
  });

  // Imprimimos la vista antes de inspeccionar una locacion.
  console.log(`Seed: ${selectedSeed}`);
  printCaseStatus("Cipher CLI Demo", openedCaseStatusView, cliRuntimeContext.storageDescription);

  // Conservamos la ultima vista conocida para encadenar acciones sobre el mismo caso.
  let currentCaseStatusView = openedCaseStatusView;

  // Recolectamos la primera pieza de evidencia de rasgo antes de abandonar la ciudad inicial.
  currentCaseStatusView = await collectTraitEvidenceUntil(
    cliRuntimeContext.visitLocation,
    currentCaseStatusView,
    1,
    "After Collecting Initial Evidence",
    cliRuntimeContext.storageDescription
  );

  // Elegimos una ciudad conectada para demostrar el subloop de navegacion.
  const selectedDestinationCityId = await chooseDestinationCity(currentCaseStatusView);

  // Si hay una conexion disponible, ejecutamos el viaje y mostramos el nuevo contexto.
  if (selectedDestinationCityId) {
    currentCaseStatusView = await cliRuntimeContext.travelToCity.execute({
      caseId: currentCaseStatusView.caseId,
      destinationCityId: selectedDestinationCityId
    });

    console.log("");
    printCaseStatus(
      "After Traveling To City",
      currentCaseStatusView,
      cliRuntimeContext.storageDescription
    );
  }

  // Recolectamos la segunda pieza de evidencia necesaria antes de comprometer la warrant.
  currentCaseStatusView = await collectTraitEvidenceUntil(
    cliRuntimeContext.visitLocation,
    currentCaseStatusView,
    2,
    "After Collecting More Evidence",
    cliRuntimeContext.storageDescription
  );

  // Elegimos los rasgos para demostrar el paso de deduccion legal del loop.
  const selectedTraitsForWarrant = await chooseTraitsForWarrant(currentCaseStatusView);

  // Si la warrant es aplicable en el estado actual, la emitimos y mostramos la nueva fase del caso.
  if (selectedTraitsForWarrant) {
    currentCaseStatusView = await cliRuntimeContext.submitWarrant.execute({
      caseId: currentCaseStatusView.caseId,
      suspectedTraits: selectedTraitsForWarrant
    });

    console.log("");
    printCaseStatus(
      "After Submitting Warrant",
      currentCaseStatusView,
      cliRuntimeContext.storageDescription
    );
  }

  // Si la warrant ya fue emitida pero aun no estamos en persecucion final, viajamos una vez mas.
  if (currentCaseStatusView.state === "WarrantIssued") {
    const finalChaseDestinationCityId = await chooseDestinationCity(currentCaseStatusView);

    if (finalChaseDestinationCityId) {
      currentCaseStatusView = await cliRuntimeContext.travelToCity.execute({
        caseId: currentCaseStatusView.caseId,
        destinationCityId: finalChaseDestinationCityId
      });

      console.log("");
      printCaseStatus(
        "After Traveling Under Warrant",
        currentCaseStatusView,
        cliRuntimeContext.storageDescription
      );
    }
  }

  // Si llegamos a la fase de persecucion, intentamos el arresto final.
  if (currentCaseStatusView.state === "Chase") {
    currentCaseStatusView = await cliRuntimeContext.attemptArrest.execute({
      caseId: currentCaseStatusView.caseId
    });

    console.log("");
    printCaseStatus(
      "After Attempting Arrest",
      currentCaseStatusView,
      cliRuntimeContext.storageDescription
    );
  }

  // Imprimimos evidencia de eventos y telemetria para hacer visible la orquestacion.
  printSideEffectSummary(cliRuntimeContext);
}

async function runStartCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const selectedSeed = parsedCliArguments.seed ?? DEMO_CASE_SEED;
  const openedCaseStatusView = await cliRuntimeContext.startCase.execute({
    seed: selectedSeed
  });

  console.log(`Seed: ${selectedSeed}`);
  printCaseStatus("Started Case", openedCaseStatusView, cliRuntimeContext.storageDescription);
  printSideEffectSummary(cliRuntimeContext);
}

async function runStatusCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const commandName =
    parsedCliArguments.command === CliCommand.RESUME ? CliCommand.RESUME : CliCommand.STATUS;
  const caseId = requireCaseId(parsedCliArguments, commandName);
  const caseStatusView = await cliRuntimeContext.getCaseStatus.execute({
    caseId
  });

  printCaseStatus(
    parsedCliArguments.command === CliCommand.RESUME ? "Resumed Case" : "Current Case Status",
    caseStatusView,
    cliRuntimeContext.storageDescription
  );
}

async function runVisitCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const caseId = requireCaseId(parsedCliArguments, CliCommand.VISIT);
  const locationId =
    parsedCliArguments.locationId ??
    (await resolveLocationIdFromCurrentCase(cliRuntimeContext, caseId));

  if (!locationId) {
    throw new Error("No pending location is available to visit.");
  }

  const caseStatusView = await cliRuntimeContext.visitLocation.execute({
    caseId,
    locationId
  });

  printCaseStatus("After Visiting Location", caseStatusView, cliRuntimeContext.storageDescription);
  printSideEffectSummary(cliRuntimeContext);
}

async function runTravelCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const caseId = requireCaseId(parsedCliArguments, CliCommand.TRAVEL);
  const destinationCityId =
    parsedCliArguments.destinationCityId ??
    (await resolveDestinationCityIdFromCurrentCase(cliRuntimeContext, caseId));

  if (!destinationCityId) {
    throw new Error("No known travel destination is available from the current city.");
  }

  const caseStatusView = await cliRuntimeContext.travelToCity.execute({
    caseId,
    destinationCityId
  });

  printCaseStatus("After Traveling To City", caseStatusView, cliRuntimeContext.storageDescription);
  printSideEffectSummary(cliRuntimeContext);
}

async function runWarrantCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const caseId = requireCaseId(parsedCliArguments, CliCommand.WARRANT);
  const currentCaseStatusView = await cliRuntimeContext.getCaseStatus.execute({
    caseId
  });
  const selectedTraitsForWarrant = await resolveTraitsForWarrantFromCurrentCase(
    currentCaseStatusView,
    parsedCliArguments.traitCodes
  );

  if (!selectedTraitsForWarrant || selectedTraitsForWarrant.length === 0) {
    throw new Error("No discovered trait evidence is available to build a warrant.");
  }

  const caseStatusView = await cliRuntimeContext.submitWarrant.execute({
    caseId,
    suspectedTraits: selectedTraitsForWarrant
  });

  printCaseStatus("After Submitting Warrant", caseStatusView, cliRuntimeContext.storageDescription);
  printSideEffectSummary(cliRuntimeContext);
}

async function runArrestCommand(
  cliRuntimeContext: CliRuntimeContext,
  parsedCliArguments: ParsedCliArguments
): Promise<void> {
  const caseId = requireCaseId(parsedCliArguments, CliCommand.ARREST);
  const caseStatusView = await cliRuntimeContext.attemptArrest.execute({
    caseId
  });

  printCaseStatus("After Attempting Arrest", caseStatusView, cliRuntimeContext.storageDescription);
  printSideEffectSummary(cliRuntimeContext);
}

async function resolveLocationIdFromCurrentCase(
  cliRuntimeContext: CliRuntimeContext,
  caseId: string
): Promise<string | null> {
  const currentCaseStatusView = await cliRuntimeContext.getCaseStatus.execute({
    caseId
  });

  return chooseLocationToVisit(currentCaseStatusView);
}

async function resolveDestinationCityIdFromCurrentCase(
  cliRuntimeContext: CliRuntimeContext,
  caseId: string
): Promise<string | null> {
  const currentCaseStatusView = await cliRuntimeContext.getCaseStatus.execute({
    caseId
  });

  return chooseDestinationCity(currentCaseStatusView);
}

async function resolveTraitsForWarrantFromCurrentCase(
  currentCaseStatusView: CaseStatusView,
  explicitTraitCodes: ReadonlyArray<string>
): Promise<CaseStatusView["discoveredTraits"] | null> {
  if (explicitTraitCodes.length === 0) {
    return chooseTraitsForWarrant(currentCaseStatusView);
  }

  const discoveredTraitsByCode = new Map(
    currentCaseStatusView.discoveredTraits.map((trait) => [trait.code, trait] as const)
  );
  const selectedTraits = [];
  const missingTraitCodes: string[] = [];

  // Convertimos codigos primitivos a la misma estructura de vista que espera `SubmitWarrant`.
  for (const explicitTraitCode of explicitTraitCodes) {
    const discoveredTrait = discoveredTraitsByCode.get(explicitTraitCode);

    if (!discoveredTrait) {
      missingTraitCodes.push(explicitTraitCode);
      continue;
    }

    selectedTraits.push(discoveredTrait);
  }

  if (missingTraitCodes.length > 0) {
    throw new Error(
      `The current case does not expose discovered trait evidence for: ${missingTraitCodes.join(", ")}.`
    );
  }

  return selectedTraits;
}

function requireCaseId(
  parsedCliArguments: ParsedCliArguments,
  commandName: Exclude<CliCommand, typeof CliCommand.DEMO | typeof CliCommand.HELP>
): string {
  if (!parsedCliArguments.caseId) {
    throw new Error(`The ${commandName} command requires a caseId.`);
  }

  return parsedCliArguments.caseId;
}

/**
 * Esta funcion interpreta los argumentos de terminal y despacha al flujo correcto.
 */
async function main(): Promise<void> {
  const parsedCliArguments = parseCliArguments(process.argv.slice(2));

  if (parsedCliArguments.command === CliCommand.HELP) {
    console.log(createCliHelpText());
    return;
  }

  const cliRuntimeContext = createCliRuntimeContext(parsedCliArguments);

  try {
    switch (parsedCliArguments.command) {
      case CliCommand.DEMO:
        await runDemoWorkflow(
          cliRuntimeContext,
          parsedCliArguments.seed ?? DEMO_CASE_SEED
        );
        return;
      case CliCommand.START:
        await runStartCommand(cliRuntimeContext, parsedCliArguments);
        return;
      case CliCommand.STATUS:
      case CliCommand.RESUME:
        await runStatusCommand(cliRuntimeContext, parsedCliArguments);
        return;
      case CliCommand.VISIT:
        await runVisitCommand(cliRuntimeContext, parsedCliArguments);
        return;
      case CliCommand.TRAVEL:
        await runTravelCommand(cliRuntimeContext, parsedCliArguments);
        return;
      case CliCommand.WARRANT:
        await runWarrantCommand(cliRuntimeContext, parsedCliArguments);
        return;
      case CliCommand.ARREST:
        await runArrestCommand(cliRuntimeContext, parsedCliArguments);
        return;
    }
  } finally {
    await closeCliRuntimeContext(cliRuntimeContext);
  }
}

function handleCliError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`CLI error: ${error.message}`);
  } else {
    console.error("CLI error: an unknown error occurred.");
  }

  process.exitCode = 1;
}

// Ejecutamos la funcion principal y degradamos errores a un mensaje corto de terminal.
void main().catch(handleCliError);
