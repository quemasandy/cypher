/**
 * Este archivo implementa un repositorio `in-memory`.
 * Su rol es cubrir dos necesidades del roadmap: pruebas deterministicas y
 * una primera persistencia local simple sin introducir base de datos.
 */
import { CaseRepository } from "@cipher/contracts";
import type { Case } from "@cipher/domain";

export class InMemoryCaseRepository extends CaseRepository<Case> {
  private readonly casesById: Map<string, Case>;

  /**
   * El constructor permite sembrar casos iniciales para tests o demos.
   */
  constructor(initialCases: ReadonlyArray<Case> = []) {
    // Llamamos al constructor base aunque hoy no haga trabajo adicional.
    super();

    // Creamos un mapa por id para resolver casos en tiempo constante.
    this.casesById = new Map();

    // Registramos cada caso inicial usando la misma ruta que usara el resto del repositorio.
    for (const caseRecord of initialCases) {
      // Guardamos cada aggregate usando su identificador de dominio como clave.
      this.casesById.set(caseRecord.id.value, caseRecord);
    }
  }

  /**
   * Este metodo recupera un aggregate por id.
   */
  async getById(caseId: string): Promise<Case | null> {
    // Leemos del mapa interno o devolvemos `null` si el caso aun no existe.
    return this.casesById.get(caseId) ?? null;
  }

  /**
   * Este metodo guarda o reemplaza un aggregate por id.
   */
  async save(caseRecord: Case): Promise<void> {
    // Persistimos la referencia actual del aggregate dentro del mapa.
    this.casesById.set(caseRecord.id.value, caseRecord);
  }
}
