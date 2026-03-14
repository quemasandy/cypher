/**
 * Este archivo transforma el estado del aggregate en una vista de aplicacion.
 * Su rol arquitectonico es evitar que CLI o futuras UIs dependan directamente
 * de entidades del dominio para presentar informacion al jugador.
 */
import type { CaseStatusSnapshot } from "@cipher/domain";

export interface CaseStatusView extends CaseStatusSnapshot {
  headline: string;
  timePressureMessage: string;
}

export function toCaseStatusView(caseSnapshot: CaseStatusSnapshot): CaseStatusView {
  // Construimos una etiqueta corta para que los adapters tengan un resumen directo del estado.
  const headline = `${caseSnapshot.agentName} is investigating ${caseSnapshot.artifactName} in ${caseSnapshot.currentCityName}.`;

  // Construimos una frase de apoyo que explique la presion del tiempo del caso.
  const timePressureMessage = `${caseSnapshot.remainingTimeHours} virtual hours remain before Cipher escapes.`;

  // Devolvemos una vista plana que la CLI puede imprimir sin conocer el dominio interno.
  return {
    ...caseSnapshot,
    headline,
    timePressureMessage
  };
}
