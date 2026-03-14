/**
 * Este archivo implementa el caso de uso `GetCaseStatus`.
 * Su responsabilidad es leer el aggregate y devolver una vista de aplicacion
 * sin mutar el dominio ni acoplar la lectura a un adapter concreto.
 */
import { DomainRuleViolationError, type Case } from "@cipher/domain";
import type { CaseRepository } from "@cipher/contracts";
import { toCaseStatusView, type CaseStatusView } from "./case-status-view.js";

export interface GetCaseStatusDependencies {
  caseRepository: CaseRepository<Case>;
}

export interface GetCaseStatusInput {
  caseId: string;
}

export class GetCaseStatus {
  private readonly caseRepository: CaseRepository<Case>;

  /**
   * El constructor recibe solo el repositorio porque este caso de uso no publica side effects.
   */
  constructor({ caseRepository }: GetCaseStatusDependencies) {
    // Guardamos el puerto de repositorio para resolver el aggregate solicitado.
    this.caseRepository = caseRepository;
  }

  /**
   * Este metodo devuelve la vista actual del caso.
   */
  async execute({ caseId }: GetCaseStatusInput): Promise<CaseStatusView> {
    // Recuperamos el aggregate desde el repositorio.
    const caseRecord = await this.caseRepository.getById(caseId);

    // Fallamos de forma semantica si el caso no existe.
    if (!caseRecord) {
      throw new DomainRuleViolationError(`Case ${caseId} was not found.`);
    }

    // Devolvemos la vista plana construida desde el snapshot del aggregate.
    return toCaseStatusView(caseRecord.toStatusSnapshot());
  }
}
