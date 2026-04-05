/**
 * Este archivo prueba el comportamiento basico del aggregate root `Case`.
 * Su lugar en la arquitectura es proteger invariantes del dominio sin pasar por adapters.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CaseState,
  DomainRuleViolationError,
  Trait,
  Warrant
} from "@cipher/domain";
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

test("Case.toStatusSnapshot exposes only discovered trait evidence, not the hidden target profile", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso y visitamos una locacion de rasgo en la ciudad inicial.
  caseRecord.start();
  caseRecord.visitLocation("rail-office");

  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que la vista publica solo muestre el rasgo realmente descubierto.
  assert.deepEqual(caseStatusSnapshot.discoveredTraits, [
    {
      code: "travels-light",
      label: "Travels light"
    }
  ]);
  assert.deepEqual(caseStatusSnapshot.discoveredTraitLabels, ["Travels light"]);
});

test("Case.travelToCity changes the current city, spends time and records travel history", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar el loop principal de investigacion.
  caseRecord.start();

  // Descubrimos primero la ruta de salida de la ciudad inicial.
  caseRecord.visitLocation("harbor-warehouse");

  // Limpiamos los eventos previos para verificar solo los del viaje.
  caseRecord.pullDomainEvents();

  // Ejecutamos un viaje valido hacia la ciudad conectada desde el nodo inicial.
  caseRecord.travelToCity("santiago");

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el agente haya cambiado de ciudad.
  assert.equal(caseRecord.currentCityId, "santiago");

  // Confirmamos que el tiempo refleje tanto la visita preparatoria como el viaje ejecutado.
  assert.equal(caseRecord.remainingTime.value, 38);

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

  // Confirmamos que la nueva ciudad exponga solo destinos ya conocidos, no todo el grafo oculto.
  assert.deepEqual(
    caseStatusSnapshot.availableTravelDestinations.map((destination) => destination.id),
    ["lima"]
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

test("Case.travelToCity rejects connected destinations that were not revealed by route evidence", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso pero aun no descubrimos ninguna pista de ruta.
  caseRecord.start();

  // Confirmamos que una conexion real siga oculta hasta que alguna pista la revele.
  assert.throws(
    () => caseRecord.travelToCity("santiago"),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "The selected destination is not supported by discovered route evidence."
  );
});

test("Case.submitWarrant records the warrant and moves the case to WarrantIssued", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar el loop principal de investigacion.
  caseRecord.start();

  // Descubrimos primero una ruta viable y el rasgo que luego respaldara la warrant emitida.
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.visitLocation("rail-office");

  // Limpiamos los eventos de apertura para verificar solo los de la warrant.
  caseRecord.pullDomainEvents();

  // Construimos una warrant valida con el rasgo deducido del fixture.
  const warrant = new Warrant({
    suspectedTraits: [
      new Trait({
        code: "travels-light",
        label: "Travels light"
      })
    ]
  });

  // Ejecutamos la emision de la warrant.
  caseRecord.submitWarrant(warrant);

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que la state machine haya avanzado a la fase correcta.
  assert.equal(caseRecord.state, CaseState.WARRANT_ISSUED);

  // Confirmamos que la warrant quede almacenada dentro del aggregate.
  assert.ok(caseRecord.warrant);
  assert.equal(caseRecord.warrant.suspectedTraits[0].code, "travels-light");

  // Confirmamos que la vista de estado exponga la orden emitida.
  assert.deepEqual(caseStatusSnapshot.issuedWarrant, {
    suspectedTraits: [
      {
        code: "travels-light",
        label: "Travels light"
      }
    ]
  });

  // Confirmamos que el aggregate emita el evento esperado.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["WarrantIssued"]
  );
});

test("Case.submitWarrant rejects attempts to submit a warrant before the case starts", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Construimos una warrant valida para enfocar la prueba en la state machine.
  const warrant = new Warrant({
    suspectedTraits: [
      new Trait({
        code: "travels-light",
        label: "Travels light"
      })
    ]
  });

  // Verificamos que emitir warrant en Briefing rompa la state machine.
  assert.throws(
    () => caseRecord.submitWarrant(warrant),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "A warrant can only be submitted while investigating the case."
  );
});

test("Case.submitWarrant rejects traits that were not supported by discovered evidence", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso sin descubrir aun ningun rasgo.
  caseRecord.start();

  const warrant = new Warrant({
    suspectedTraits: [
      new Trait({
        code: "travels-light",
        label: "Travels light"
      })
    ]
  });

  // Confirmamos que el aggregate ya no permita emitir warrants con conocimiento oculto.
  assert.throws(
    () => caseRecord.submitWarrant(warrant),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "Warrant traits must be supported by discovered trait evidence."
  );
});

test("Case.submitWarrant rejects attempts to issue a second warrant", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso para habilitar la emision.
  caseRecord.start();

  // Descubrimos una ruta viable y el rasgo requerido para que la primera warrant sea valida.
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.visitLocation("rail-office");

  // Construimos una warrant valida.
  const warrant = new Warrant({
    suspectedTraits: [
      new Trait({
        code: "travels-light",
        label: "Travels light"
      })
    ]
  });

  // Emitimos la primera warrant valida.
  caseRecord.submitWarrant(warrant);

  // Confirmamos que una segunda emision rompa la state machine.
  assert.throws(
    () => caseRecord.submitWarrant(warrant),
    (error: unknown) =>
      error instanceof DomainRuleViolationError &&
      error.message === "A warrant can only be submitted while investigating the case."
  );
});

test("Case.travelToCity enters Chase when a warranted investigation reaches the final city", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso y emitimos una warrant parcial para entrar a la siguiente fase.
  caseRecord.start();
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.visitLocation("rail-office");
  caseRecord.submitWarrant(
    new Warrant({
      suspectedTraits: [
        new Trait({
          code: "travels-light",
          label: "Travels light"
        })
      ]
    })
  );

  // Limpiamos los eventos previos para observar solo el viaje hacia la ciudad final.
  caseRecord.pullDomainEvents();

  // Viajamos a la ciudad final definida por el fixture.
  caseRecord.travelToCity("santiago");

  // Confirmamos que la state machine ahora entre en persecucion final.
  assert.equal(caseRecord.state, CaseState.CHASE);
});

test("Case.attemptArrest resolves the case successfully in the final city with a matching warrant", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso y descubrimos los dos rasgos requeridos antes de emitir la warrant.
  caseRecord.start();
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.visitLocation("rail-office");
  caseRecord.travelToCity("santiago");
  caseRecord.visitLocation("night-train-yard");
  caseRecord.submitWarrant(
    new Warrant({
      suspectedTraits: [
        new Trait({
          code: "travels-light",
          label: "Travels light"
        }),
        new Trait({
          code: "prefers-night-trains",
          label: "Prefers night trains"
        })
      ]
    })
  );

  // La warrant emitida en la ciudad final activa `Chase`; limpiamos eventos previos para aislar el cierre.
  caseRecord.pullDomainEvents();

  // Ejecutamos el arresto final.
  caseRecord.attemptArrest();

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el caso quede resuelto con captura exitosa.
  assert.equal(caseRecord.state, CaseState.RESOLVED);
  assert.equal(caseStatusSnapshot.resolution?.outcome, "Arrested");
  assert.equal(caseStatusSnapshot.resolution?.cause, "ArrestSuccess");

  // Confirmamos que el aggregate emita el evento de resolucion correcto.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["CaseResolved"]
  );
});

test("Case.attemptArrest resolves the case as escape when the warrant does not match the target", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso y descubrimos el rasgo que luego usaremos en una warrant incompleta.
  caseRecord.start();
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.visitLocation("rail-office");
  caseRecord.travelToCity("santiago");
  caseRecord.submitWarrant(
    new Warrant({
      suspectedTraits: [
        new Trait({
          code: "travels-light",
          label: "Travels light"
        })
      ]
    })
  );

  // La warrant emitida en la ciudad final activa `Chase`; limpiamos eventos previos para aislar el cierre.
  caseRecord.pullDomainEvents();

  // Ejecutamos el arresto final.
  caseRecord.attemptArrest();

  // Leemos el snapshot actualizado para verificar la vista del aggregate.
  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el caso quede resuelto como escape por warrant incorrecta.
  assert.equal(caseRecord.state, CaseState.RESOLVED);
  assert.equal(caseStatusSnapshot.resolution?.outcome, "Escaped");
  assert.equal(caseStatusSnapshot.resolution?.cause, "WrongWarrant");

  // Confirmamos que el aggregate emita tanto la resolucion como el escape.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["CaseResolved", "CipherEscaped"]
  );
});

test("Case resolves as escape when the remaining budget cannot pay any further action", () => {
  // Creamos un fixture puro del dominio.
  const caseRecord = createBriefingCaseFixture();

  // Abrimos el caso y agotamos primero todas las locaciones investigables del fixture.
  caseRecord.start();
  caseRecord.visitLocation("harbor-warehouse");
  caseRecord.travelToCity("santiago");
  caseRecord.visitLocation("observatory-platform");
  caseRecord.visitLocation("night-train-yard");
  caseRecord.travelToCity("bogota");

  // Visitamos tambien la pista de Bogota para que luego no quede ninguna accion barata disponible.
  caseRecord.visitLocation("embassy-garage");

  // Recorremos viajes repetibles hasta dejar el caso con tiempo insuficiente para cualquier accion.
  caseRecord.travelToCity("santiago");
  caseRecord.travelToCity("bogota");
  caseRecord.travelToCity("santiago");

  // Limpiamos eventos previos para verificar solo el ultimo viaje que vuelve el caso inviable.
  caseRecord.pullDomainEvents();

  // Este ultimo viaje deja 1 hora, sin locaciones pendientes y sin ninguna conexion pagable.
  caseRecord.travelToCity("bogota");

  const caseStatusSnapshot = caseRecord.toStatusSnapshot();

  // Confirmamos que el aggregate cierre el caso automaticamente como escape por presupuesto agotado.
  assert.equal(caseRecord.state, CaseState.RESOLVED);
  assert.equal(caseStatusSnapshot.remainingTimeHours, 1);
  assert.equal(caseStatusSnapshot.resolution?.outcome, "Escaped");
  assert.equal(caseStatusSnapshot.resolution?.cause, "TimeExpired");

  // Confirmamos que el dominio publique tanto el viaje como la resolucion terminal.
  assert.deepEqual(
    caseRecord.pullDomainEvents().map((domainEvent) => domainEvent.type),
    ["CityTraveled", "CaseResolved", "CipherEscaped"]
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
