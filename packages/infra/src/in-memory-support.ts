/**
 * Este archivo agrupa adapters simples de infraestructura para el primer vertical.
 * Se mantiene pequeno a proposito para que sea facil recorrerlo como material didactico.
 */
import { EventBus, Telemetry, type TelemetryPayload } from "@cipher/contracts";
import {
  Agent,
  Artifact,
  Case,
  CaseId,
  Cipher,
  City,
  Location,
  TimeBudgetHours,
  Trait,
  type CaseDomainEvent
} from "@cipher/domain";

export interface TelemetryEntry {
  eventName: string;
  payload: TelemetryPayload;
}

export class InMemoryEventBus extends EventBus<CaseDomainEvent> {
  readonly publishedEvents: CaseDomainEvent[];

  /**
   * El constructor inicializa la lista de eventos publicados.
   */
  constructor() {
    // Llamamos al constructor base por consistencia con el contrato abstracto.
    super();

    // Esta coleccion permite inspeccionar que eventos salieron del caso de uso.
    this.publishedEvents = [];
  }

  /**
   * Este metodo publica una lista de eventos agregandolos a memoria.
   */
  async publish(domainEvents: ReadonlyArray<CaseDomainEvent>): Promise<void> {
    // Copiamos los eventos para registrar exactamente lo que recibio el adapter.
    this.publishedEvents.push(...domainEvents.map((domainEvent) => ({ ...domainEvent })));
  }
}

export class InMemoryTelemetry extends Telemetry {
  readonly recordedEntries: TelemetryEntry[];

  /**
   * El constructor inicializa el registro de telemetria capturada.
   */
  constructor() {
    // Llamamos al constructor base por consistencia con el contrato abstracto.
    super();

    // Esta coleccion deja evidencia de los eventos tecnicos emitidos por la aplicacion.
    this.recordedEntries = [];
  }

  /**
   * Este metodo agrega una entrada tecnica de telemetria en memoria.
   */
  async track(eventName: string, payload: TelemetryPayload): Promise<void> {
    // Persistimos una copia superficial para evitar mutaciones externas posteriores.
    this.recordedEntries.push({
      eventName,
      payload: { ...payload }
    });
  }
}

/**
 * Esta factoria construye un caso de demostracion pequeno pero consistente.
 * Vive en infraestructura porque su objetivo es bootstrapping y demo, no una regla del dominio.
 */
export function createDemoBriefingCase(): Case {
  // Definimos los rasgos base del objetivo para futuras warrants.
  const targetTraits = [
    new Trait({
      code: "uses-coded-messages",
      label: "Uses coded messages"
    }),
    new Trait({
      code: "prefers-rare-books",
      label: "Prefers rare books"
    })
  ];

  // Definimos las locaciones de la ciudad inicial con pistas sencillas.
  const quitoLocations = [
    new Location({
      id: "national-archive",
      name: "National Archive",
      clue: {
        type: "trait",
        summary: "A witness saw the thief studying restoration manuals."
      }
    }),
    new Location({
      id: "old-airfield",
      name: "Old Airfield",
      clue: {
        type: "route",
        summary: "A cargo manifest points toward a southern escape corridor."
      }
    })
  ];

  // Construimos la ciudad inicial del primer vertical.
  const quito = new City({
    id: "quito",
    name: "Quito",
    locations: quitoLocations
  });

  // Construimos el aggregate root en estado `Briefing`.
  return Case.createBriefing({
    id: new CaseId("tutorial-case"),
    activeAgent: new Agent({
      id: "trace-rookie-01",
      name: "Agent Vega",
      agency: "TRACE"
    }),
    target: new Cipher({
      alias: "Cipher",
      traits: targetTraits
    }),
    artifact: new Artifact({
      id: "sun-tablet",
      name: "Tablet of the First Eclipse",
      historicalOrigin: "Recovered from an Andean ceremonial complex."
    }),
    openingCity: quito,
    cities: [quito],
    timeBudgetHours: TimeBudgetHours.fromNumber(72)
  });
}
