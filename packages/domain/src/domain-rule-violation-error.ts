/**
 * Este archivo define un error del dominio con nombre semantico.
 * Su rol arquitectonico es dar una forma consistente de expresar violaciones
 * de reglas del negocio sin mezclar el dominio con detalles de UI o infraestructura.
 */
export class DomainRuleViolationError extends Error {
  /**
   * El constructor recibe el mensaje concreto de la regla rota.
   * Mantener el mensaje cerca del dominio ayuda a que tests y adapters expliquen mejor el fallo.
   */
  constructor(message: string) {
    // Llamamos al constructor base de Error para conservar stack trace y comportamiento nativo.
    super(message);

    // Renombramos el error para que los adapters y los tests puedan reconocerlo con claridad.
    this.name = "DomainRuleViolationError";
  }
}
