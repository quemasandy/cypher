/**
 * Este archivo implementa el primer adapter ejecutable del proyecto.
 * Su rol es demostrar que la arquitectura ya permite abrir un caso real
 * recorriendo dominio, aplicacion e infraestructura sin mezclar responsabilidades.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  GetCaseStatus,
  StartCase,
  TravelToCity,
  VisitLocation,
  type CaseStatusView
} from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry,
  createDemoBriefingCase
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
  console.log(`Target traits: ${caseStatusView.targetTraitLabels.join(", ")}`);
  console.log(`Artifact: ${caseStatusView.artifactName}`);
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
  // Creamos un caso inicial de demostracion en estado `Briefing`.
  const demoCase = createDemoBriefingCase();

  // Creamos el repositorio `in-memory` sembrado con ese caso.
  const caseRepository = new InMemoryCaseRepository([demoCase]);

  // Creamos un bus de eventos en memoria para observar lo que publica la aplicacion.
  const eventBus = new InMemoryEventBus();

  // Creamos un collector simple de telemetria para el mismo flujo.
  const telemetry = new InMemoryTelemetry();

  // Instanciamos el caso de uso que inicia la investigacion.
  const startCase = new StartCase({
    caseRepository,
    eventBus,
    telemetry
  });

  // Instanciamos el caso de uso de lectura para demostrar una consulta separada.
  const getCaseStatus = new GetCaseStatus({
    caseRepository
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

  // Ejecutamos el caso de uso de inicio usando el id del aggregate sembrado.
  await startCase.execute({
    caseId: demoCase.id.value
  });

  // Leemos el estado abierto para mostrar el punto de partida del loop de investigacion.
  const openedCaseStatusView = await getCaseStatus.execute({
    caseId: demoCase.id.value
  });

  // Imprimimos la vista antes de inspeccionar una locacion.
  printCaseStatus("Cipher CLI Demo", openedCaseStatusView);

  // Conservamos la ultima vista conocida para encadenar acciones sobre el mismo caso.
  let currentCaseStatusView = openedCaseStatusView;

  // Elegimos una locacion para demostrar la primera accion investigativa del juego.
  const selectedLocationId = await chooseLocationToVisit(currentCaseStatusView);

  // Si hay una locacion pendiente, ejecutamos el comando y mostramos el nuevo estado.
  if (selectedLocationId) {
    currentCaseStatusView = await visitLocation.execute({
      caseId: demoCase.id.value,
      locationId: selectedLocationId
    });

    console.log("");
    printCaseStatus("After Visiting Location", currentCaseStatusView);
  }

  // Elegimos una ciudad conectada para demostrar el subloop de navegacion.
  const selectedDestinationCityId = await chooseDestinationCity(currentCaseStatusView);

  // Si hay una conexion disponible, ejecutamos el viaje y mostramos el nuevo contexto.
  if (selectedDestinationCityId) {
    currentCaseStatusView = await travelToCity.execute({
      caseId: demoCase.id.value,
      destinationCityId: selectedDestinationCityId
    });

    console.log("");
    printCaseStatus("After Traveling To City", currentCaseStatusView);
  }

  // Imprimimos evidencia de eventos y telemetria para hacer visible la orquestacion.
  console.log(`Published domain events: ${eventBus.publishedEvents.length}`);
  console.log(`Recorded telemetry entries: ${telemetry.recordedEntries.length}`);
}

// Ejecutamos la funcion principal y dejamos que Node marque fallo si algo explota.
void main();
