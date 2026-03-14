/**
 * Este archivo implementa el caso de uso `StartCase`.
 * Vive en la capa de aplicacion porque coordina puertos, aggregate root y side effects,
 * pero no contiene decisiones de infraestructura ni de presentacion.
 */
import { DomainRuleViolationError, type Case, type CaseDomainEvent } from "@cipher/domain";
import type { CaseRepository, EventBus, Telemetry } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface StartCaseDependencies {
  caseRepository: CaseRepository<Case>;
  eventBus: EventBus<CaseDomainEvent>;
  telemetry: Telemetry;
}

export interface StartCaseInput {
  caseId: string;
}

export class StartCase {
  private readonly caseRepository: CaseRepository<Case>;
  private readonly eventBus: EventBus<CaseDomainEvent>;
  private readonly telemetry: Telemetry;

  /**
   * El constructor recibe los puertos que la aplicacion necesita para trabajar.
   */
  constructor({ caseRepository, eventBus, telemetry }: StartCaseDependencies) {
    // Guardamos el puerto de repositorio para cargar y persistir el caso.
    this.caseRepository = caseRepository;

    // Guardamos el bus de eventos para publicar eventos de dominio despues de la mutacion.
    this.eventBus = eventBus;

    // Guardamos el puerto de telemetria para observabilidad y trazabilidad.
    this.telemetry = telemetry;
  }

  /**
   * Este metodo ejecuta el flujo completo de inicio del caso.
   */
  async execute({ caseId }: StartCaseInput): Promise<CaseStatusView> {
    // Cargamos el aggregate root desde el repositorio.
    const caseRecord = await this.caseRepository.getById(caseId);

    // Si no existe un caso con ese id, el use case falla con un mensaje claro.
    if (!caseRecord) {
      throw new DomainRuleViolationError(`Case ${caseId} was not found.`);
    }

    // Delegamos al aggregate la validacion y la mutacion del estado.
    caseRecord.start();

    // Persistimos el aggregate ya mutado antes de emitir side effects externos.
    await this.caseRepository.save(caseRecord);

    // Extraemos los eventos emitidos por el aggregate en esta unidad de trabajo.
    const domainEvents = caseRecord.pullDomainEvents();

    // Publicamos los eventos a traves del puerto abstracto.
    await this.eventBus.publish(domainEvents);

    // Registramos un evento tecnico de alto nivel para observabilidad del caso de uso.
    await this.telemetry.track("case_started", {
      caseId,
      currentState: caseRecord.state
    });

    // Convertimos el aggregate en una vista plana apta para adapters.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
