/**
 * Este archivo implementa el aggregate root `Case`.
 * Su responsabilidad es concentrar consistencia, estado y eventos del juego
 * para que la capa de aplicacion orqueste casos de uso sin romper invariantes.
 */
import { CaseState } from "./case-state.js";
import { DomainRuleViolationError } from "./domain-rule-violation-error.js";
import { Agent, Artifact, CaseId, Cipher, City } from "./supporting-types.js";
import { TimeBudgetHours } from "./time-budget-hours.js";

// En el MVP la visita consume un costo fijo para mantener el modelo simple y didactico.
const LOCATION_VISIT_TIME_COST_HOURS = 4;

export interface CaseOpenedDomainEvent {
  type: "CaseOpened";
  caseId: string;
  currentCityId: string;
  remainingTimeHours: number;
}

export interface LocationVisitedDomainEvent {
  type: "LocationVisited";
  caseId: string;
  cityId: string;
  locationId: string;
  remainingTimeHours: number;
}

export interface ClueCollectedDomainEvent {
  type: "ClueCollected";
  caseId: string;
  cityId: string;
  locationId: string;
  clueType: string;
  clueSummary: string;
}

export type CaseDomainEvent =
  | CaseOpenedDomainEvent
  | LocationVisitedDomainEvent
  | ClueCollectedDomainEvent;

export interface AvailableLocationSnapshot {
  id: string;
  name: string;
  isVisited: boolean;
  clueSummary: string | null;
}

export interface CaseStatusSnapshot {
  caseId: string;
  state: CaseState;
  agentName: string;
  agencyName: string;
  targetAlias: string;
  targetTraitLabels: string[];
  artifactName: string;
  artifactOrigin: string;
  currentCityId: string;
  currentCityName: string;
  remainingTimeHours: number;
  availableLocations: AvailableLocationSnapshot[];
  visitedLocationNames: string[];
  collectedClues: string[];
}

export type CaseWarrant = Record<string, unknown> | null;
export type CaseResolution = Record<string, unknown> | null;

export interface CaseProps {
  id: CaseId;
  state: CaseState;
  activeAgent: Agent;
  target: Cipher;
  artifact: Artifact;
  cities: ReadonlyArray<City>;
  currentCityId: string;
  remainingTime: TimeBudgetHours;
  travelHistory?: ReadonlyArray<string>;
  visitedLocationIds?: ReadonlyArray<string>;
  collectedClues?: ReadonlyArray<string>;
  warrant?: CaseWarrant;
  resolution?: CaseResolution;
}

export interface BriefingCaseProps {
  id: CaseId;
  activeAgent: Agent;
  target: Cipher;
  artifact: Artifact;
  openingCity: City;
  cities: ReadonlyArray<City>;
  timeBudgetHours: TimeBudgetHours;
}

export class Case {
  id: CaseId;
  state: CaseState;
  activeAgent: Agent;
  target: Cipher;
  artifact: Artifact;
  cities: City[];
  currentCityId: string;
  remainingTime: TimeBudgetHours;
  travelHistory: string[];
  visitedLocationIds: string[];
  collectedClues: string[];
  warrant: CaseWarrant;
  resolution: CaseResolution;
  private domainEvents: CaseDomainEvent[];

  /**
   * El constructor recibe el estado ya validado del aggregate.
   * Se mantiene como detalle interno de la clase; el punto de entrada recomendado
   * para crear un caso nuevo es `createBriefing`.
   */
  constructor({
    id,
    state,
    activeAgent,
    target,
    artifact,
    cities,
    currentCityId,
    remainingTime,
    travelHistory = [],
    visitedLocationIds = [],
    collectedClues = [],
    warrant = null,
    resolution = null
  }: CaseProps) {
    // Verificamos el tipo del identificador del caso.
    if (!(id instanceof CaseId)) {
      throw new DomainRuleViolationError("Case id must be a CaseId instance.");
    }

    // Verificamos que el estado sea uno de los estados canonicos del dominio.
    if (!Object.values(CaseState).includes(state)) {
      throw new DomainRuleViolationError("Case state must be one of the canonical case states.");
    }

    // El agente activo debe pertenecer al tipo correcto del dominio.
    if (!(activeAgent instanceof Agent)) {
      throw new DomainRuleViolationError("Case agent must be an Agent instance.");
    }

    // El objetivo del caso debe ser un `Cipher` valido.
    if (!(target instanceof Cipher)) {
      throw new DomainRuleViolationError("Case target must be a Cipher instance.");
    }

    // El artefacto robado debe existir como entidad valida.
    if (!(artifact instanceof Artifact)) {
      throw new DomainRuleViolationError("Case artifact must be an Artifact instance.");
    }

    // El caso necesita al menos una ciudad para que exista un espacio navegable.
    if (!Array.isArray(cities) || cities.length === 0) {
      throw new DomainRuleViolationError("Case must contain at least one city.");
    }

    // Todas las ciudades deben respetar el tipo del dominio.
    if (!cities.every((city) => city instanceof City)) {
      throw new DomainRuleViolationError("Case cities must be City instances.");
    }

    // El presupuesto restante debe ser un value object del dominio.
    if (!(remainingTime instanceof TimeBudgetHours)) {
      throw new DomainRuleViolationError("Case remaining time must be a TimeBudgetHours instance.");
    }

    // El `currentCityId` debe apuntar a una ciudad existente dentro del agregado.
    if (!cities.some((city) => city.id === currentCityId)) {
      throw new DomainRuleViolationError("Case current city must exist within the case city list.");
    }

    // Persistimos la identidad del caso.
    this.id = id;

    // Persistimos el estado actual de la state machine.
    this.state = state;

    // Persistimos el detective activo.
    this.activeAgent = activeAgent;

    // Persistimos el objetivo del caso.
    this.target = target;

    // Persistimos el artefacto buscado.
    this.artifact = artifact;

    // Copiamos la lista de ciudades para evitar mutaciones externas accidentales.
    this.cities = [...cities];

    // Guardamos la ciudad actual del agente.
    this.currentCityId = currentCityId;

    // Guardamos el presupuesto restante de tiempo.
    this.remainingTime = remainingTime;

    // Guardamos el historial de viajes inicial o reconstruido.
    this.travelHistory = [...travelHistory];

    // Guardamos las locaciones ya visitadas.
    this.visitedLocationIds = [...visitedLocationIds];

    // Guardamos las pistas ya recolectadas.
    this.collectedClues = [...collectedClues];

    // Guardamos la warrant si existe.
    this.warrant = warrant;

    // Guardamos la resolucion si el caso ya termino.
    this.resolution = resolution;

    // Inicializamos el buffer de eventos de dominio emitidos durante esta unidad de trabajo.
    this.domainEvents = [];
  }

  /**
   * Esta factoria crea un caso en estado `Briefing`.
   * Se usa para respetar la state machine documentada: primero existe el caso, luego se inicia.
   */
  static createBriefing({
    id,
    activeAgent,
    target,
    artifact,
    openingCity,
    cities,
    timeBudgetHours
  }: BriefingCaseProps): Case {
    // La factoria delega validacion estructural al constructor y fija solo las decisiones de arranque.
    return new Case({
      id,
      state: CaseState.BRIEFING,
      activeAgent,
      target,
      artifact,
      cities,
      currentCityId: openingCity.id,
      remainingTime: timeBudgetHours,
      travelHistory: [],
      visitedLocationIds: [],
      collectedClues: [],
      warrant: null,
      resolution: null
    });
  }

  /**
   * Este caso de dominio arranca la investigacion desde `Briefing`.
   */
  start(): void {
    // Verificamos la precondicion principal de la state machine.
    this.ensureStateIs(
      CaseState.BRIEFING,
      "A case can only start from the Briefing state."
    );

    // Avanzamos el aggregate al estado que habilita el loop principal.
    this.state = CaseState.INVESTIGATING;

    // Registramos un evento de dominio para que la aplicacion pueda publicarlo luego.
    this.recordDomainEvent({
      type: "CaseOpened",
      caseId: this.id.value,
      currentCityId: this.currentCityId,
      remainingTimeHours: this.remainingTime.value
    });
  }

  /**
   * Este metodo modela la primera accion investigativa real del juego.
   * Solo permite visitar locaciones de la ciudad actual mientras el caso esta investigandose.
   */
  visitLocation(locationId: string): void {
    // La visita de locaciones pertenece al loop principal de investigacion.
    this.ensureStateIs(
      CaseState.INVESTIGATING,
      "Locations can only be visited while investigating the case."
    );

    // Resolvemos la ciudad actual para verificar que la locacion exista dentro del contexto activo.
    const currentCity = this.getCurrentCity();

    // Buscamos la locacion solicitada dentro de la ciudad actual, no en todo el mundo del caso.
    const locationToVisit = currentCity.locations.find((location) => location.id === locationId);

    // Fallamos si la locacion no pertenece a la ciudad actual del agente.
    if (!locationToVisit) {
      throw new DomainRuleViolationError(
        "The selected location does not exist in the current city."
      );
    }

    // Evitamos duplicar tiempo, visitas y pistas sobre la misma locacion.
    if (this.visitedLocationIds.includes(locationToVisit.id)) {
      throw new DomainRuleViolationError(
        "A location cannot be visited twice within the same case."
      );
    }

    // Consumimos tiempo antes de registrar los efectos para mantener la secuencia del dominio explicita.
    this.remainingTime = this.remainingTime.spend(LOCATION_VISIT_TIME_COST_HOURS);

    // Registramos la locacion como ya inspeccionada dentro del aggregate.
    this.visitedLocationIds.push(locationToVisit.id);

    // Incorporamos la pista revelada al historial plano del caso.
    this.collectedClues.push(locationToVisit.clue.summary);

    // Emitimos el evento de visita para adapters o telemetria futura.
    this.recordDomainEvent({
      type: "LocationVisited",
      caseId: this.id.value,
      cityId: currentCity.id,
      locationId: locationToVisit.id,
      remainingTimeHours: this.remainingTime.value
    });

    // Emitimos un evento separado para dejar visible la incorporacion de informacion al caso.
    this.recordDomainEvent({
      type: "ClueCollected",
      caseId: this.id.value,
      cityId: currentCity.id,
      locationId: locationToVisit.id,
      clueType: locationToVisit.clue.type,
      clueSummary: locationToVisit.clue.summary
    });
  }

  /**
   * Este metodo construye una vista plana y segura del estado del aggregate.
   * Es util para la capa de aplicacion y para pruebas iniciales.
   */
  toStatusSnapshot(): CaseStatusSnapshot {
    // Resolvemos la ciudad actual una sola vez para reutilizarla en la vista.
    const currentCity = this.getCurrentCity();

    // Resolvemos las locaciones visitadas en todo el caso para que la vista no dependa de la ciudad actual.
    const visitedLocationNames = this.cities
      .flatMap((city) => city.locations)
      .filter((location) => this.visitedLocationIds.includes(location.id))
      .map((location) => location.name);

    // Transformamos las locaciones de la ciudad actual en una vista que oculte pistas no descubiertas.
    const availableLocations = currentCity.locations.map((location) => {
      // Resolver aqui el flag evita que cada adapter de interfaz replique la misma regla.
      const isVisited = this.visitedLocationIds.includes(location.id);

      return {
        id: location.id,
        name: location.name,
        isVisited,
        clueSummary: isVisited ? location.clue.summary : null
      };
    });

    // Devolvemos un objeto plano para evitar que la capa de aplicacion exponga entidades completas.
    return {
      caseId: this.id.value,
      state: this.state,
      agentName: this.activeAgent.name,
      agencyName: this.activeAgent.agency,
      targetAlias: this.target.alias,
      targetTraitLabels: this.target.traits.map((trait) => trait.label),
      artifactName: this.artifact.name,
      artifactOrigin: this.artifact.historicalOrigin,
      currentCityId: currentCity.id,
      currentCityName: currentCity.name,
      remainingTimeHours: this.remainingTime.value,
      availableLocations,
      visitedLocationNames,
      collectedClues: [...this.collectedClues]
    };
  }

  /**
   * Este metodo devuelve y limpia los eventos acumulados.
   * El patron permite que la capa de aplicacion controle cuando publicarlos.
   */
  pullDomainEvents(): CaseDomainEvent[] {
    // Copiamos los eventos para no exponer la referencia mutable interna.
    const eventsToPublish = [...this.domainEvents];

    // Limpiamos el buffer porque ya no queremos republicar eventos anteriores.
    this.domainEvents = [];

    // Entregamos la coleccion de eventos al caller.
    return eventsToPublish;
  }

  /**
   * Este helper resuelve la ciudad actual y falla si el aggregate quedo inconsistente.
   */
  getCurrentCity(): City {
    // Buscamos la ciudad cuyo id coincide con la posicion actual del agente.
    const currentCity = this.cities.find((city) => city.id === this.currentCityId);

    // Si no existe, el aggregate quedo corrupto y debemos fallar de forma explicita.
    if (!currentCity) {
      throw new DomainRuleViolationError("Current city could not be resolved from the case state.");
    }

    // Devolvemos la entidad de ciudad encontrada.
    return currentCity;
  }

  /**
   * Este helper encapsula la validacion repetida de estado esperado.
   */
  private ensureStateIs(expectedState: CaseState, message: string): void {
    // Si el estado actual no coincide con el esperado, la operacion viola la state machine.
    if (this.state !== expectedState) {
      throw new DomainRuleViolationError(message);
    }
  }

  /**
   * Este helper agrega eventos al buffer interno del aggregate.
   */
  private recordDomainEvent(domainEvent: CaseDomainEvent): void {
    // Guardamos una copia superficial del evento para evitar mutaciones externas futuras.
    this.domainEvents.push({ ...domainEvent });
  }
}
