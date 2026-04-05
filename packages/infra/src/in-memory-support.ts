/**
 * Este archivo agrupa adapters simples de infraestructura para el primer vertical.
 * Se mantiene pequeno a proposito para que sea facil recorrerlo como material didactico.
 */
import { EventBus, Telemetry, type TelemetryPayload } from "@cipher/contracts";
import { Case, type CaseDomainEvent } from "@cipher/domain";
import { ProceduralCaseGenerator } from "./procedural-case-generator.js";

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

// Esta `seed` fija una demo estable para CLI y ejemplos del repositorio.
export const DEMO_CASE_SEED = "tutorial-case-v1";

/**
 * Esta factoria conserva un punto de entrada simple para demos y tests ligeros.
 * Aunque devuelve un aggregate listo para usarse, internamente ya delega al generador procedural
 * para mantener alineados el camino de demo y el camino real de `StartCase`.
 */
export function createDemoBriefingCase(): Case {
  const proceduralCaseGenerator = new ProceduralCaseGenerator();
  return proceduralCaseGenerator.generateFromSeed(DEMO_CASE_SEED);
}
