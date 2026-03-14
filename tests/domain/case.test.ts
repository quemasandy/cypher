/**
 * Este archivo prueba el comportamiento basico del aggregate root `Case`.
 * Su lugar en la arquitectura es proteger invariantes del dominio sin pasar por adapters.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CaseState, DomainRuleViolationError } from "@cipher/domain";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";

test("Case.start moves the aggregate from Briefing to Investigating", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Ejecutamos la transicion principal del primer vertical.
  caseRecord.start();

  // Verificamos que el aggregate haya cambiado al estado correcto.
  assert.equal(caseRecord.state, CaseState.INVESTIGATING);
});

test("Case.start records a CaseOpened domain event", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Ejecutamos la mutacion del aggregate.
  caseRecord.start();

  // Extraemos los eventos generados por la operacion.
  const domainEvents = caseRecord.pullDomainEvents();

  // Verificamos que exista exactamente un evento.
  assert.equal(domainEvents.length, 1);

  // Verificamos que el tipo del evento coincida con la regla del dominio.
  assert.equal(domainEvents[0].type, "CaseOpened");
});

test("Case.start rejects attempts to start the same case twice", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Ejecutamos la primera apertura valida del caso.
  caseRecord.start();

  // Verificamos que un segundo intento rompa la state machine con un error semantico.
  assert.throws(
    () => caseRecord.start(),
    (error) =>
      error instanceof DomainRuleViolationError &&
      error.message === "A case can only start from the Briefing state."
  );
});
