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
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "A case can only start from the Briefing state."
  );
});

test("Case.visitLocation reveals the clue, records the visit and spends time", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para entrar al loop principal permitido.
  caseRecord.start();

  // Limpiamos los eventos de apertura para verificar solo los de la visita.
  caseRecord.pullDomainEvents();

  // Ejecutamos la visita a la unica locacion del fixture.
  caseRecord.visitLocation("harbor-warehouse");

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el tiempo haya bajado segun el costo fijo de investigacion.
  assert.equal(caseRecord.remainingTime.value, 44);

  // Confirmamos que la locacion quede marcada como ya visitada.
  assert.deepEqual(caseRecord.visitedLocationIds, ["harbor-warehouse"]);

  // Confirmamos que la pista antes oculta ahora sea visible en la vista del caso.
  assert.equal(
    caseStatusSnapshot.availableLocations[0].clueSummary,
    "Shipping crates point to a fast maritime transfer."
  );

  // Confirmamos que el caso conserve la pista en su historial plano.
  assert.deepEqual(caseStatusSnapshot.collectedClues, [
    "Shipping crates point to a fast maritime transfer."
  ]);

  // Confirmamos que el aggregate emita los dos eventos del flujo investigativo.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["LocationVisited", "ClueCollected"]
  );
});

test("Case.visitLocation rejects visits before the case has started", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Verificamos que visitar una locacion en Briefing rompa la state machine.
  assert.throws(
    () => caseRecord.visitLocation("harbor-warehouse"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "Locations can only be visited while investigating the case."
  );
});

test("Case.travelToCity changes the current city, spends time and records travel history", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar el loop principal de investigacion.
  caseRecord.start();

  // Limpiamos los eventos de apertura para verificar solo los del viaje.
  caseRecord.pullDomainEvents();

  // Ejecutamos un viaje valido hacia la ciudad conectada desde el nodo inicial.
  caseRecord.travelToCity("santiago");

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el agente haya cambiado de ciudad.
  assert.equal(caseRecord.currentCityId, "santiago");

  // Confirmamos que el tiempo haya bajado segun el costo de la conexion elegida.
  assert.equal(caseRecord.remainingTime.value, 42);

  // Confirmamos que el historial de viajes guarde una entrada explicita del desplazamiento.
  assert.deepEqual(caseStatusSnapshot.travelHistory, [
    {
      fromCityId: "lima",
      fromCityName: "Lima",
      toCityId: "santiago",
      toCityName: "Santiago",
      travelTimeHours: 6
    }
  ]);

  // Confirmamos que la nueva ciudad exponga sus propias conexiones al adapter.
  assert.deepEqual(
    caseStatusSnapshot.availableTravelDestinations.map((destination) => destination.id),
    ["lima", "bogota"]
  );

  // Confirmamos que el aggregate emita el evento de viaje esperado.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["CityTraveled"]
  );
});

test("Case.travelToCity rejects travel attempts before the case has started", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Verificamos que viajar en Briefing rompa la state machine.
  assert.throws(
    () => caseRecord.travelToCity("santiago"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "Cities can only be traveled while the case is active."
  );
});

test("Case.travelToCity rejects traveling to the current city", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar viajes.
  caseRecord.start();

  // Confirmamos que intentar quedarse en la misma ciudad rompa una invariante del dominio.
  assert.throws(
    () => caseRecord.travelToCity("lima"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "The agent is already in the selected city."
  );
});

test("Case.travelToCity rejects destinations that are not connected to the current city", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar viajes.
  caseRecord.start();

  // Confirmamos que una ciudad existente pero no conectada no pueda elegirse todavia.
  assert.throws(
    () => caseRecord.travelToCity("bogota"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "The selected destination cannot be reached from the current city."
  );
});

test("Case.visitLocation rejects visiting the same location twice", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar visitas.
  caseRecord.start();

  // Ejecutamos una primera visita valida.
  caseRecord.visitLocation("harbor-warehouse");

  // Confirmamos que la segunda visita a la misma locacion rompa una invariante.
  assert.throws(
    () => caseRecord.visitLocation("harbor-warehouse"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "A location cannot be visited twice within the same case."
  );
});
