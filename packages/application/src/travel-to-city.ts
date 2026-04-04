/**
 * Este archivo implementa el caso de uso `TravelToCity`.
 * Vive en aplicacion porque coordina el comando de viaje del jugador con
 * el aggregate root, los puertos externos y la vista consumible por adapters.
 */
import { DomainRuleViolationError, type Case, type CaseDomainEvent } from "@cipher/domain";
import type { CaseRepository, EventBus, Telemetry } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface TravelToCityDependencies {
  caseRepository: CaseRepository<Case>;
  eventBus: EventBus<CaseDomainEvent>;
  telemetry: Telemetry;
}

export interface TravelToCityInput {
  caseId: string;
  destinationCityId: string;
}

export class TravelToCity {
  private readonly caseRepository: CaseRepository<Case>;
  private readonly eventBus: EventBus<CaseDomainEvent>;
  private readonly telemetry: Telemetry;

  /**
   * El constructor recibe los mismos puertos del resto de comandos mutantes.
   */
  constructor({ caseRepository, eventBus, telemetry }: TravelToCityDependencies) {
    // Guardamos el repositorio para recuperar y persistir el aggregate.
    this.caseRepository = caseRepository;

    // Guardamos el bus para publicar los eventos emitidos por el dominio.
    this.eventBus = eventBus;

    // Guardamos telemetria para dejar una huella tecnica del desplazamiento del jugador.
    this.telemetry = telemetry;
  }

  /**
   * Este metodo ejecuta un viaje hacia una ciudad conectada con la actual.
   */
  async execute({ caseId, destinationCityId }: TravelToCityInput): Promise<CaseStatusView> {
    // Recuperamos el aggregate del caso solicitado.
    const caseRecord = await this.caseRepository.getById(caseId);

    // Fallamos de forma semantica si el repositorio no conoce ese caso.
    if (!caseRecord) {
      throw new DomainRuleViolationError(`Case ${caseId} was not found.`);
    }

    // Delegamos al aggregate la validacion de conectividad y la mutacion del viaje.
    caseRecord.travelToCity(destinationCityId);

    // Persistimos el estado resultante antes de publicar side effects externos.
    await this.caseRepository.save(caseRecord);

    // Extraemos los eventos emitidos durante esta accion puntual.
    const domainEvents = caseRecord.pullDomainEvents();

    // Publicamos esos eventos para que otros adapters puedan reaccionar.
    await this.eventBus.publish(domainEvents);

    // Registramos la accion a nivel de observabilidad tecnica.
    await this.telemetry.track("city_traveled", {
      caseId,
      destinationCityId,
      currentCityId: caseRecord.currentCityId,
      currentState: caseRecord.state
    });

    // Devolvemos la vista actualizada para que la interfaz muestre el nuevo contexto.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
