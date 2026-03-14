/**
 * Este archivo modela el recurso principal del MVP: horas virtuales disponibles.
 * Se implementa como value object para encapsular validaciones y evitar
 * que el tiempo quede representado como un numero libre por todo el sistema.
 */
import { DomainRuleViolationError } from "./domain-rule-violation-error.js";

export class TimeBudgetHours {
  readonly value: number;

  /**
   * El constructor es privado por convencion de equipo.
   * Se usa la factoria `fromNumber` para dejar una sola entrada validada.
   */
  private constructor(value: number) {
    // Guardamos el numero validado como estado interno inmutable por contrato de uso.
    this.value = value;
  }

  /**
   * Esta factoria convierte un numero primitivo en un value object seguro.
   */
  static fromNumber(value: number): TimeBudgetHours {
    // Rechazamos valores no numericos porque rompen la semantica del presupuesto de tiempo.
    if (!Number.isFinite(value)) {
      throw new DomainRuleViolationError("Time budget hours must be a finite number.");
    }

    // Rechazamos negativos porque un caso no puede iniciar con tiempo menor que cero.
    if (value < 0) {
      throw new DomainRuleViolationError("Time budget hours cannot be negative.");
    }

    // Rechazamos fracciones para mantener el modelo inicial simple y discreto.
    if (!Number.isInteger(value)) {
      throw new DomainRuleViolationError("Time budget hours must be expressed as a whole number.");
    }

    // Si todas las reglas se cumplen, construimos el value object validado.
    return new TimeBudgetHours(value);
  }

  /**
   * Este metodo devuelve un nuevo value object con horas consumidas.
   * No muta la instancia actual para preservar el estilo de value object.
   */
  spend(hours: number): TimeBudgetHours {
    // Validamos el costo recibido antes de tocar el presupuesto restante.
    if (!Number.isInteger(hours) || hours < 0) {
      throw new DomainRuleViolationError("Spent hours must be a non-negative whole number.");
    }

    // Si el costo supera el presupuesto, la operacion viola una invariante del juego.
    if (hours > this.value) {
      throw new DomainRuleViolationError("There is not enough remaining time for this action.");
    }

    // Creamos una nueva instancia en lugar de cambiar la actual para mantener consistencia conceptual.
    return new TimeBudgetHours(this.value - hours);
  }
}
