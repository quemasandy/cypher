/**
 * Este archivo define los puertos de salida de la aplicacion.
 * En TypeScript podriamos usar interfaces puras, pero mantenemos clases abstractas
 * pequenas para conservar contratos ejecutables y faciles de leer en runtime.
 */
function createUnimplementedMessage(methodName: string): string {
  // Este helper centraliza el error para que todos los puertos fallen de forma consistente.
  return `${methodName} must be implemented by an infrastructure adapter.`;
}

export interface DomainEvent {
  type: string;
}

export type TelemetryPayload = Record<string, unknown>;

export abstract class CaseRepository<TCaseRecord> {
  /**
   * Este metodo debe recuperar un aggregate `Case` por su identificador.
   */
  async getById(_caseId: string): Promise<TCaseRecord | null> {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("CaseRepository.getById"));
  }

  /**
   * Este metodo debe persistir el aggregate actualizado.
   */
  async save(_caseRecord: TCaseRecord): Promise<void> {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("CaseRepository.save"));
  }
}

export abstract class CaseGenerator<TCaseRecord> {
  /**
   * Este metodo debe construir un aggregate reproducible a partir de una `seed`.
   */
  generateFromSeed(_seed: string): TCaseRecord {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("CaseGenerator.generateFromSeed"));
  }
}

export abstract class RandomnessProvider {
  /**
   * Este metodo debe devolver un entero reproducible dentro de un rango semiabierto.
   */
  nextInteger(_minInclusive: number, _maxExclusive: number, _scopeKey: string): number {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("RandomnessProvider.nextInteger"));
  }

  /**
   * Este metodo debe elegir un valor estable de una lista segun la `seed` y el `scope`.
   */
  pickOne<T>(_values: ReadonlyArray<T>, _scopeKey: string): T {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("RandomnessProvider.pickOne"));
  }

  /**
   * Este metodo debe elegir varios valores unicos de una lista de forma reproducible.
   */
  pickMany<T>(_values: ReadonlyArray<T>, _count: number, _scopeKey: string): T[] {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("RandomnessProvider.pickMany"));
  }
}

export abstract class EventBus<TDomainEvent extends DomainEvent = DomainEvent> {
  /**
   * Este metodo debe publicar una coleccion de eventos de dominio.
   */
  async publish(_domainEvents: ReadonlyArray<TDomainEvent>): Promise<void> {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("EventBus.publish"));
  }
}

export abstract class Telemetry {
  /**
   * Este metodo debe registrar un evento tecnico o de negocio.
   */
  async track(_eventName: string, _payload: TelemetryPayload): Promise<void> {
    // Lanzamos un error explicito porque este puerto no debe instanciarse directamente.
    throw new Error(createUnimplementedMessage("Telemetry.track"));
  }
}
