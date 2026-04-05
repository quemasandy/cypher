/**
 * Este archivo implementa el caso de uso `SubmitWarrant`.
 * Vive en aplicacion porque coordina la emision de la warrant con
 * el aggregate root, los puertos externos y la vista consumible por adapters.
 */
import {
  DomainRuleViolationError,
  Trait,
  Warrant,
  type Case,
  type CaseDomainEvent
} from "@cipher/domain";
import type { CaseRepository, EventBus, Telemetry } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface SubmittedWarrantTraitInput {
  code: string;
  label: string;
}

export interface SubmitWarrantDependencies {
  caseRepository: CaseRepository<Case>;
  eventBus: EventBus<CaseDomainEvent>;
  telemetry: Telemetry;
}

export interface SubmitWarrantInput {
  caseId: string;
  suspectedTraits: ReadonlyArray<SubmittedWarrantTraitInput>;
}

export class SubmitWarrant {
  private readonly caseRepository: CaseRepository<Case>;
  private readonly eventBus: EventBus<CaseDomainEvent>;
  private readonly telemetry: Telemetry;

  /**
   * El constructor recibe los mismos puertos del resto de comandos mutantes.
   */
  constructor({ caseRepository, eventBus, telemetry }: SubmitWarrantDependencies) {
    // Guardamos el repositorio para recuperar y persistir el aggregate.
    this.caseRepository = caseRepository;

    // Guardamos el bus para publicar los eventos emitidos por el dominio.
    this.eventBus = eventBus;

    // Guardamos telemetria para dejar una huella tecnica de la orden emitida.
    this.telemetry = telemetry;
  }

  /**
   * Este metodo ejecuta la emision de una warrant con la hipotesis elegida por el jugador.
   */
  async execute({ caseId, suspectedTraits }: SubmitWarrantInput): Promise<CaseStatusView> {
    // Recuperamos el aggregate del caso solicitado.
    const caseRecord = await this.caseRepository.getById(caseId);

    // Fallamos de forma semantica si el repositorio no conoce ese caso.
    if (!caseRecord) {
      throw new DomainRuleViolationError(`Case ${caseId} was not found.`);
    }

    // Convertimos la entrada primitiva del adapter en value objects del dominio.
    const warrant = new Warrant({
      suspectedTraits: suspectedTraits.map(
        (traitInput) =>
          new Trait({
            code: traitInput.code,
            label: traitInput.label
          })
      )
    });

    // Delegamos al aggregate la validacion de la state machine y la mutacion real.
    caseRecord.submitWarrant(warrant);

    // Persistimos el estado resultante antes de publicar side effects externos.
    await this.caseRepository.save(caseRecord);

    // Extraemos los eventos emitidos durante esta accion puntual.
    const domainEvents = caseRecord.pullDomainEvents();

    // Publicamos esos eventos para que otros adapters puedan reaccionar.
    await this.eventBus.publish(domainEvents);

    // Registramos la accion a nivel de observabilidad tecnica.
    await this.telemetry.track("warrant_submitted", {
      caseId,
      suspectedTraitCodes: warrant.suspectedTraits.map((trait) => trait.code),
      currentState: caseRecord.state
    });

    // Devolvemos la vista actualizada para que la interfaz muestre la nueva fase del caso.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
