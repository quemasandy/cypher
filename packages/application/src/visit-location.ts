/**
 * Este archivo implementa el caso de uso `VisitLocation`.
 * Vive en aplicacion porque coordina la accion investigativa del jugador con
 * el aggregate root, los puertos externos y la vista consumible por adapters.
 */
import { DomainRuleViolationError, type Case, type CaseDomainEvent } from "@cipher/domain";
import type { CaseRepository, EventBus, Telemetry } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface VisitLocationDependencies {
  caseRepository: CaseRepository<Case>;
  eventBus: EventBus<CaseDomainEvent>;
  telemetry: Telemetry;
}

export interface VisitLocationInput {
  caseId: string;
  locationId: string;
}

export class VisitLocation {
  private readonly caseRepository: CaseRepository<Case>;
  private readonly eventBus: EventBus<CaseDomainEvent>;
  private readonly telemetry: Telemetry;

  /**
   * El constructor recibe los mismos puertos del resto de comandos mutantes.
   */
  constructor({ caseRepository, eventBus, telemetry }: VisitLocationDependencies) {
    // Guardamos el repositorio para recuperar y persistir el aggregate.
    this.caseRepository = caseRepository;

    // Guardamos el bus para publicar los eventos emitidos por el dominio.
    this.eventBus = eventBus;

    // Guardamos telemetria para dejar una huella tecnica de la accion del jugador.
    this.telemetry = telemetry;
  }

  /**
   * Este metodo ejecuta la visita de una locacion de la ciudad actual.
   */
  async execute({ caseId, locationId }: VisitLocationInput): Promise<CaseStatusView> {
    // Recuperamos el aggregate del caso solicitado.
    const caseRecord = await this.caseRepository.getById(caseId);

    // Fallamos de forma semantica si el repositorio no conoce ese caso.
    if (!caseRecord) {
      throw new DomainRuleViolationError(`Case ${caseId} was not found.`);
    }

    // Delegamos al aggregate la validacion del estado y la mutacion investigativa.
    caseRecord.visitLocation(locationId);

    // Persistimos el estado resultante antes de publicar side effects externos.
    await this.caseRepository.save(caseRecord);

    // Extraemos los eventos emitidos durante esta accion puntual.
    const domainEvents = caseRecord.pullDomainEvents();

    // Publicamos esos eventos para que otros adapters puedan reaccionar.
    await this.eventBus.publish(domainEvents);

    // Registramos la accion a nivel de observabilidad tecnica.
    await this.telemetry.track("location_visited", {
      caseId,
      locationId,
      currentCityId: caseRecord.currentCityId,
      currentState: caseRecord.state
    });

    // Devolvemos la vista actualizada para que la interfaz muestre la nueva informacion.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
