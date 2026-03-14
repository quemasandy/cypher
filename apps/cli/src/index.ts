/**
 * Este archivo implementa el primer adapter ejecutable del proyecto.
 * Su rol es demostrar que la arquitectura ya permite abrir un caso real
 * recorriendo dominio, aplicacion e infraestructura sin mezclar responsabilidades.
 */
import { GetCaseStatus, StartCase, type CaseStatusView } from "@cipher/application";
import {
  InMemoryCaseRepository,
  InMemoryEventBus,
  InMemoryTelemetry,
  createDemoBriefingCase
} from "@cipher/infra";

/**
 * Este helper imprime una vista amigable del caso para la terminal.
 */
function printCaseStatus(caseStatusView: CaseStatusView): void {
  // Imprimimos una separacion visual para que la salida sea mas facil de leer.
  console.log("=== Cipher CLI Demo ===");

  // Imprimimos el resumen principal del caso.
  console.log(caseStatusView.headline);

  // Imprimimos la presion de tiempo que define el loop del juego.
  console.log(caseStatusView.timePressureMessage);

  // Mostramos datos clave del contexto actual del caso.
  console.log(`State: ${caseStatusView.state}`);
  console.log(`Current city: ${caseStatusView.currentCityName}`);
  console.log(`Target traits: ${caseStatusView.targetTraitLabels.join(", ")}`);
  console.log(`Artifact: ${caseStatusView.artifactName}`);
  console.log("Available locations:");

  // Recorremos las locaciones disponibles para mostrar la informacion inmediata del jugador.
  for (const location of caseStatusView.availableLocations) {
    // Cada locacion muestra su nombre y el resumen de la pista asociada.
    console.log(`- ${location.name}: ${location.clueSummary}`);
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

  // Ejecutamos el caso de uso de inicio usando el id del aggregate sembrado.
  await startCase.execute({
    caseId: demoCase.id.value
  });

  // Leemos el estado ya persistido desde el repositorio para cerrar el recorrido completo.
  const caseStatusView = await getCaseStatus.execute({
    caseId: demoCase.id.value
  });

  // Imprimimos la vista final preparada por la capa de aplicacion.
  printCaseStatus(caseStatusView);

  // Imprimimos evidencia de eventos y telemetria para hacer visible la orquestacion.
  console.log(`Published domain events: ${eventBus.publishedEvents.length}`);
  console.log(`Recorded telemetry entries: ${telemetry.recordedEntries.length}`);
}

// Ejecutamos la funcion principal y dejamos que Node marque fallo si algo explota.
void main();
