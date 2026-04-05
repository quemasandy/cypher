/**
 * Este archivo transforma el estado del aggregate en una vista de aplicacion.
 * Su rol arquitectonico es evitar que CLI o futuras UIs dependan directamente
 * de entidades del dominio para presentar informacion al jugador.
 */
import {
  CaseResolutionCauseValues,
  CaseState,
  type CaseStatusSnapshot
} from "@cipher/domain";

export interface CaseStatusView extends CaseStatusSnapshot {
  headline: string;
  timePressureMessage: string;
}

export function toCaseStatusView(caseSnapshot: CaseStatusSnapshot): CaseStatusView {
  // Construimos una etiqueta corta dependiente del estado para que la UI no narre mal el caso.
  let headline = `${caseSnapshot.agentName} is tracking ${caseSnapshot.artifactName}.`;

  // Elegimos una frase distinta segun la fase de la state machine.
  switch (caseSnapshot.state) {
    case CaseState.BRIEFING:
      headline = `${caseSnapshot.agentName} is preparing the dossier for ${caseSnapshot.artifactName}.`;
      break;
    case CaseState.INVESTIGATING:
      headline = `${caseSnapshot.agentName} is investigating ${caseSnapshot.artifactName} in ${caseSnapshot.currentCityName}.`;
      break;
    case CaseState.WARRANT_ISSUED:
      headline = `${caseSnapshot.agentName} has issued a warrant while operating in ${caseSnapshot.currentCityName}.`;
      break;
    case CaseState.CHASE:
      headline = `${caseSnapshot.agentName} is chasing Cipher through ${caseSnapshot.currentCityName}.`;
      break;
    case CaseState.RESOLVED:
      headline =
        caseSnapshot.resolution?.outcome === "Arrested"
          ? `${caseSnapshot.agentName} has arrested Cipher and closed the case.`
          : `${caseSnapshot.agentName} has closed the case after Cipher escaped.`;
      break;
  }

  // Construimos una frase de apoyo que explique la presion de tiempo segun el estado actual.
  const timePressureMessage =
    caseSnapshot.state === CaseState.RESOLVED
      ? caseSnapshot.resolution?.outcome === "Arrested"
        ? `${caseSnapshot.remainingTimeHours} virtual hours remained at the moment of capture.`
        : caseSnapshot.resolution?.cause === CaseResolutionCauseValues.TIME_EXPIRED
          ? "The remaining time budget no longer allowed the pursuit to continue."
          : `Cipher escaped with ${caseSnapshot.remainingTimeHours} virtual hours remaining.`
      : `${caseSnapshot.remainingTimeHours} virtual hours remain before Cipher escapes.`;

  // Devolvemos una vista plana que la CLI puede imprimir sin conocer el dominio interno.
  return {
    ...caseSnapshot,
    headline,
    timePressureMessage
  };
}
