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
  [key: string]: unknown;
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
