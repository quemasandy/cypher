/**
 * Este archivo implementa el caso de uso `StartCase`.
 * Vive en la capa de aplicacion porque coordina generacion procedural, aggregate root
 * y side effects, pero no contiene decisiones de infraestructura ni de presentacion.
 */
import { DomainRuleViolationError, type Case, type CaseDomainEvent } from "@cipher/domain";
import type { CaseGenerator, CaseRepository, EventBus, Telemetry } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface StartCaseDependencies {
  caseGenerator: CaseGenerator<Case>;
  caseRepository: CaseRepository<Case>;
  eventBus: EventBus<CaseDomainEvent>;
  telemetry: Telemetry;
}

export interface StartCaseInput {
  seed: string;
}

export class StartCase {
  private readonly caseGenerator: CaseGenerator<Case>;
  private readonly caseRepository: CaseRepository<Case>;
  private readonly eventBus: EventBus<CaseDomainEvent>;
  private readonly telemetry: Telemetry;

  /**
   * El constructor recibe los puertos que la aplicacion necesita para trabajar.
   */
  constructor({ caseGenerator, caseRepository, eventBus, telemetry }: StartCaseDependencies) {
    // Guardamos el generador para construir un caso reproducible desde una `seed`.
    this.caseGenerator = caseGenerator;

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
  async execute({ seed }: StartCaseInput): Promise<CaseStatusView> {
    // Validamos la entrada antes de invocar infraestructura para mantener errores de uso claros.
    if (typeof seed !== "string" || seed.trim().length === 0) {
      throw new DomainRuleViolationError("StartCase requires a non-empty seed.");
    }

    const normalizedSeed = seed.trim();

    // Pedimos al generador un aggregate nuevo y reproducible para esta `seed`.
    const caseRecord = this.caseGenerator.generateFromSeed(normalizedSeed);

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
      caseId: caseRecord.id.value,
      seed: normalizedSeed,
      currentState: caseRecord.state
    });

    // Convertimos el aggregate en una vista plana apta para adapters.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
