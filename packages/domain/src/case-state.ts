/**
 * Este archivo concentra los estados canonicos del aggregate root `Case`.
 * Vive en la capa de dominio porque la maquina de estados es una regla de negocio,
 * no una decision de interfaz.
 */
export const CaseState = Object.freeze({
  // `Briefing` representa el momento en que el caso existe pero aun no empezo la operacion.
  BRIEFING: "Briefing",

  // `Investigating` habilita el loop principal de viajes, visitas y recoleccion de pistas.
  INVESTIGATING: "Investigating",

  // `WarrantIssued` representa el compromiso del jugador con una hipotesis legal.
  WARRANT_ISSUED: "WarrantIssued",

  // `Chase` modela la persecucion final hacia el cierre del caso.
  CHASE: "Chase",

  // `Resolved` marca un estado terminal donde ya no se aceptan mutaciones.
  RESOLVED: "Resolved"
} as const);

export type CaseState = (typeof CaseState)[keyof typeof CaseState];
