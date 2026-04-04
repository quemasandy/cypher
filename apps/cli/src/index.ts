/**
 * Este archivo implementa el primer adapter ejecutable del proyecto.
 * Su rol es demostrar que la arquitectura ya permite abrir un caso real
 * recorriendo dominio, aplicacion e infraestructura sin mezclar responsabilidades.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  AttemptArrest,
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
  ProceduralCaseGenerator
} from "@cipher/infra";

/**
 * Este helper imprime una vista amigable del caso para la terminal.
 */
function printCaseStatus(title: string, caseStatusView: CaseStatusView): void {
  // Imprimimos una separacion visual para que la salida sea mas facil de leer.
  console.log(`=== ${title} ===`);

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

  // Mostramos los destinos de viaje conectados a la ciudad actual.
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
 * Este helper selecciona los rasgos que compondran la warrant.
 * En modo no interactivo usa todos los rasgos disponibles para que la demo siga siendo determinista.
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
  titlePrefix: string
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
      currentCaseStatusView
    );
  }

  return currentCaseStatusView;
}

/**
 * Este helper selecciona una locacion a visitar.
 * En modo no interactivo elige la primera pendiente para mantener la demo automatizable.
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

    // Si la entrada no es valida, degradamos a la primera opcion para no romper la demo.
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
 * En modo no interactivo elige la primera conexion disponible para mantener la demo automatizable.
 */
async function chooseDestinationCity(caseStatusView: CaseStatusView): Promise<string | null> {
  // Si no hay conexiones salientes, no tiene sentido pedir una decision de viaje.
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

    // Si la entrada no es valida, degradamos a la primera opcion para no romper la demo.
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
 * Esta funcion arma el grafo de dependencias del vertical slice y ejecuta la demo.
 */
async function main(): Promise<void> {
  // Elegimos una `seed` fija por defecto, pero permitimos sobreescribirla desde la terminal.
  const selectedSeed = process.argv[2] ?? DEMO_CASE_SEED;

  // Creamos el repositorio `in-memory` vacio porque `StartCase` ahora construye el aggregate.
  const caseRepository = new InMemoryCaseRepository();

  // Creamos un bus de eventos en memoria para observar lo que publica la aplicacion.
  const eventBus = new InMemoryEventBus();

  // Creamos un collector simple de telemetria para el mismo flujo.
  const telemetry = new InMemoryTelemetry();

  // Creamos el generador procedural concreto que traducira la `seed` en un caso reproducible.
  const caseGenerator = new ProceduralCaseGenerator();

  // Instanciamos el caso de uso que inicia la investigacion.
  const startCase = new StartCase({
    caseGenerator,
    caseRepository,
    eventBus,
    telemetry
  });

  // Instanciamos el caso de uso que revela pistas a traves de una visita real.
  const visitLocation = new VisitLocation({
    caseRepository,
    eventBus,
    telemetry
  });

  // Instanciamos el caso de uso que mueve al agente entre ciudades conectadas.
  const travelToCity = new TravelToCity({
    caseRepository,
    eventBus,
    telemetry
  });

  // Instanciamos el caso de uso que registra la warrant emitida por el jugador.
  const submitWarrant = new SubmitWarrant({
    caseRepository,
    eventBus,
    telemetry
  });

  // Instanciamos el caso de uso que intenta cerrar el caso con la captura final.
  const attemptArrest = new AttemptArrest({
    caseRepository,
    eventBus,
    telemetry
  });

  // Ejecutamos el caso de uso de inicio usando una `seed` reproducible.
  const openedCaseStatusView = await startCase.execute({
    seed: selectedSeed
  });

  // Imprimimos la vista antes de inspeccionar una locacion.
  console.log(`Seed: ${selectedSeed}`);
  printCaseStatus("Cipher CLI Demo", openedCaseStatusView);

  // Conservamos la ultima vista conocida para encadenar acciones sobre el mismo caso.
  let currentCaseStatusView = openedCaseStatusView;

  // Recolectamos la primera pieza de evidencia de rasgo antes de abandonar la ciudad inicial.
  currentCaseStatusView = await collectTraitEvidenceUntil(
    visitLocation,
    currentCaseStatusView,
    1,
    "After Collecting Initial Evidence"
  );

  // Elegimos una ciudad conectada para demostrar el subloop de navegacion.
  const selectedDestinationCityId = await chooseDestinationCity(currentCaseStatusView);

  // Si hay una conexion disponible, ejecutamos el viaje y mostramos el nuevo contexto.
  if (selectedDestinationCityId) {
    currentCaseStatusView = await travelToCity.execute({
      caseId: currentCaseStatusView.caseId,
      destinationCityId: selectedDestinationCityId
    });

    console.log("");
    printCaseStatus("After Traveling To City", currentCaseStatusView);
  }

  // Recolectamos la segunda pieza de evidencia necesaria antes de comprometer la warrant.
  currentCaseStatusView = await collectTraitEvidenceUntil(
    visitLocation,
    currentCaseStatusView,
    2,
    "After Collecting More Evidence"
  );

  // Elegimos los rasgos para demostrar el paso de deduccion legal del loop.
  const selectedTraitsForWarrant = await chooseTraitsForWarrant(currentCaseStatusView);

  // Si la warrant es aplicable en el estado actual, la emitimos y mostramos la nueva fase del caso.
  if (selectedTraitsForWarrant) {
    currentCaseStatusView = await submitWarrant.execute({
      caseId: currentCaseStatusView.caseId,
      suspectedTraits: selectedTraitsForWarrant
    });

    console.log("");
    printCaseStatus("After Submitting Warrant", currentCaseStatusView);
  }

  // Si la warrant ya fue emitida pero aun no estamos en persecucion final, viajamos una vez mas.
  if (currentCaseStatusView.state === "WarrantIssued") {
    const finalChaseDestinationCityId = await chooseDestinationCity(currentCaseStatusView);

    if (finalChaseDestinationCityId) {
      currentCaseStatusView = await travelToCity.execute({
        caseId: currentCaseStatusView.caseId,
        destinationCityId: finalChaseDestinationCityId
      });

      console.log("");
      printCaseStatus("After Traveling Under Warrant", currentCaseStatusView);
    }
  }

  // Si llegamos a la fase de persecucion, intentamos el arresto final.
  if (currentCaseStatusView.state === "Chase") {
    currentCaseStatusView = await attemptArrest.execute({
      caseId: currentCaseStatusView.caseId
    });

    console.log("");
    printCaseStatus("After Attempting Arrest", currentCaseStatusView);
  }

  // Imprimimos evidencia de eventos y telemetria para hacer visible la orquestacion.
  console.log(`Published domain events: ${eventBus.publishedEvents.length}`);
  console.log(`Recorded telemetry entries: ${telemetry.recordedEntries.length}`);
}

// Ejecutamos la funcion principal y dejamos que Node marque fallo si algo explota.
void main();
