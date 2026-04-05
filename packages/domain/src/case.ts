/**
 * Este archivo implementa el aggregate root `Case`.
 * Su responsabilidad es concentrar consistencia, estado y eventos del juego
 * para que la capa de aplicacion orqueste casos de uso sin romper invariantes.
 */
import { CaseState } from "./case-state.js";
import { DomainRuleViolationError } from "./domain-rule-violation-error.js";
import {
  Agent,
  Artifact,
  CaseId,
  Cipher,
  City,
  Trait,
  Warrant
} from "./supporting-types.js";
import { TimeBudgetHours } from "./time-budget-hours.js";

// En el MVP la visita consume un costo fijo para mantener el modelo simple y didactico.
const LOCATION_VISIT_TIME_COST_HOURS = 4;

export const CaseResolutionOutcome = Object.freeze({
  ARRESTED: "Arrested",
  ESCAPED: "Escaped"
} as const);

export type CaseResolutionOutcome =
  (typeof CaseResolutionOutcome)[keyof typeof CaseResolutionOutcome];

export const CaseResolutionCause = Object.freeze({
  ARREST_SUCCESS: "ArrestSuccess",
  TIME_EXPIRED: "TimeExpired",
  WRONG_WARRANT: "WrongWarrant",
  WRONG_CITY: "WrongCity"
} as const);

export type CaseResolutionCause =
  (typeof CaseResolutionCause)[keyof typeof CaseResolutionCause];

export type EscapeResolutionCause =
  | (typeof CaseResolutionCause.TIME_EXPIRED)
  | (typeof CaseResolutionCause.WRONG_WARRANT)
  | (typeof CaseResolutionCause.WRONG_CITY);

export interface CaseOpenedDomainEvent {
  type: "CaseOpened";
  caseId: string;
  currentCityId: string;
  remainingTimeHours: number;
}

export interface CityTraveledDomainEvent {
  type: "CityTraveled";
  caseId: string;
  fromCityId: string;
  toCityId: string;
  travelTimeHours: number;
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

export interface WarrantIssuedDomainEvent {
  type: "WarrantIssued";
  caseId: string;
  suspectedTraitCodes: string[];
  suspectedTraitLabels: string[];
}

export interface CaseResolvedDomainEvent {
  type: "CaseResolved";
  caseId: string;
  outcome: CaseResolutionOutcome;
  cause: CaseResolutionCause;
  currentCityId: string;
  remainingTimeHours: number;
}

export interface CipherEscapedDomainEvent {
  type: "CipherEscaped";
  caseId: string;
  cause: EscapeResolutionCause;
  currentCityId: string;
}

export type CaseDomainEvent =
  | CaseOpenedDomainEvent
  | CityTraveledDomainEvent
  | LocationVisitedDomainEvent
  | ClueCollectedDomainEvent
  | WarrantIssuedDomainEvent
  | CaseResolvedDomainEvent
  | CipherEscapedDomainEvent;

export interface TraitSnapshot {
  code: string;
  label: string;
}

export interface AvailableLocationSnapshot {
  id: string;
  name: string;
  isVisited: boolean;
  clueSummary: string | null;
}

export interface AvailableTravelDestinationSnapshot {
  id: string;
  name: string;
  travelTimeHours: number;
}

export interface TravelHistoryEntry {
  fromCityId: string;
  toCityId: string;
  travelTimeHours: number;
}

export interface TravelHistorySnapshot extends TravelHistoryEntry {
  fromCityName: string;
  toCityName: string;
}

export interface IssuedWarrantSnapshot {
  suspectedTraits: TraitSnapshot[];
}

export interface CaseResolutionSnapshot {
  outcome: CaseResolutionOutcome;
  cause: CaseResolutionCause;
  summary: string;
}

export interface CaseStatusSnapshot {
  caseId: string;
  state: CaseState;
  agentName: string;
  agencyName: string;
  targetAlias: string;
  discoveredTraits: TraitSnapshot[];
  discoveredTraitLabels: string[];
  artifactName: string;
  artifactOrigin: string;
  currentCityId: string;
  currentCityName: string;
  remainingTimeHours: number;
  issuedWarrant: IssuedWarrantSnapshot | null;
  resolution: CaseResolutionSnapshot | null;
  availableLocations: AvailableLocationSnapshot[];
  availableTravelDestinations: AvailableTravelDestinationSnapshot[];
  visitedLocationNames: string[];
  collectedClues: string[];
  travelHistory: TravelHistorySnapshot[];
}

export type CaseWarrant = Warrant | null;
export type CaseResolution = CaseResolutionSnapshot | null;

export interface CaseProps {
  id: CaseId;
  state: CaseState;
  activeAgent: Agent;
  target: Cipher;
  artifact: Artifact;
  cities: ReadonlyArray<City>;
  currentCityId: string;
  finalCityId: string;
  remainingTime: TimeBudgetHours;
  travelHistory?: ReadonlyArray<TravelHistoryEntry>;
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
  finalCity: City;
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
  finalCityId: string;
  remainingTime: TimeBudgetHours;
  travelHistory: TravelHistoryEntry[];
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
    finalCityId,
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

    // Preparamos un indice de ids para validar consistencia del grafo del caso.
    const knownCityIds = new Set(cities.map((city) => city.id));

    // Exigimos ids unicos para que viaje, historial y estado no queden ambiguos.
    if (knownCityIds.size !== cities.length) {
      throw new DomainRuleViolationError("Case cities must use unique city ids.");
    }

    // El `currentCityId` debe apuntar a una ciudad existente dentro del agregado.
    if (!knownCityIds.has(currentCityId)) {
      throw new DomainRuleViolationError("Case current city must exist within the case city list.");
    }

    // El caso necesita una ciudad final valida para cerrar la persecucion.
    if (!knownCityIds.has(finalCityId)) {
      throw new DomainRuleViolationError("Case final city must exist within the case city list.");
    }

    // Validamos que las conexiones de viaje apunten a ciudades reales y no se dupliquen.
    for (const city of cities) {
      const destinationIdsSeen = new Set<string>();

      for (const connection of city.connections) {
        if (connection.destinationCityId === city.id) {
          throw new DomainRuleViolationError("A city cannot define a travel connection to itself.");
        }

        if (!knownCityIds.has(connection.destinationCityId)) {
          throw new DomainRuleViolationError(
            "City connections must point to cities that exist inside the case."
          );
        }

        if (destinationIdsSeen.has(connection.destinationCityId)) {
          throw new DomainRuleViolationError(
            "A city cannot define the same travel destination more than once."
          );
        }

        destinationIdsSeen.add(connection.destinationCityId);
      }

      // Tambien validamos que las pistas que revelan destinos apunten a ciudades reales del caso.
      for (const location of city.locations) {
        const revealedDestinationCityId = location.clue.revealedDestinationCityId;

        if (revealedDestinationCityId === undefined) {
          continue;
        }

        if (!knownCityIds.has(revealedDestinationCityId)) {
          throw new DomainRuleViolationError(
            "Clues can only reveal destination cities that exist inside the case."
          );
        }

        if (revealedDestinationCityId === city.id) {
          throw new DomainRuleViolationError(
            "A clue cannot reveal the same city that already contains the location."
          );
        }
      }
    }

    // Validamos que el historial de viajes sea estructuralmente coherente con el caso.
    if (!Array.isArray(travelHistory)) {
      throw new DomainRuleViolationError("Case travel history must be provided as an array.");
    }

    for (const travelEntry of travelHistory) {
      if (typeof travelEntry !== "object" || travelEntry === null) {
        throw new DomainRuleViolationError("Case travel history entries must be objects.");
      }

      if (
        typeof travelEntry.fromCityId !== "string" ||
        travelEntry.fromCityId.trim().length === 0 ||
        typeof travelEntry.toCityId !== "string" ||
        travelEntry.toCityId.trim().length === 0
      ) {
        throw new DomainRuleViolationError(
          "Case travel history entries must include non-empty origin and destination city ids."
        );
      }

      if (!Number.isInteger(travelEntry.travelTimeHours) || travelEntry.travelTimeHours <= 0) {
        throw new DomainRuleViolationError(
          "Case travel history entries must include a positive whole-number travel cost."
        );
      }

      if (!knownCityIds.has(travelEntry.fromCityId) || !knownCityIds.has(travelEntry.toCityId)) {
        throw new DomainRuleViolationError(
          "Case travel history entries must reference cities that exist in the case."
        );
      }
    }

    // Si existe una warrant reconstruida, debe respetar el value object del dominio.
    if (warrant !== null && !(warrant instanceof Warrant)) {
      throw new DomainRuleViolationError("Case warrant must be a Warrant instance or null.");
    }

    // Si existe una resolucion reconstruida, validamos su forma explicita.
    if (resolution !== null) {
      if (typeof resolution !== "object") {
        throw new DomainRuleViolationError("Case resolution must be an object or null.");
      }

      if (!Object.values(CaseResolutionOutcome).includes(resolution.outcome)) {
        throw new DomainRuleViolationError("Case resolution outcome must be canonical.");
      }

      if (!Object.values(CaseResolutionCause).includes(resolution.cause)) {
        throw new DomainRuleViolationError("Case resolution cause must be canonical.");
      }

      if (typeof resolution.summary !== "string" || resolution.summary.trim().length === 0) {
        throw new DomainRuleViolationError("Case resolution summary must be a non-empty string.");
      }
    }

    // Los estados que dependen de una warrant deben reconstruirse con esa evidencia ya presente.
    if (
      (state === CaseState.WARRANT_ISSUED || state === CaseState.CHASE) &&
      warrant === null
    ) {
      throw new DomainRuleViolationError(
        "A case in WarrantIssued or Chase state must contain a warrant."
      );
    }

    // Antes de emitir warrant, el aggregate aun no debe guardar una orden comprometida.
    if (
      warrant !== null &&
      (state === CaseState.BRIEFING || state === CaseState.INVESTIGATING)
    ) {
      throw new DomainRuleViolationError(
        "A warrant cannot exist before the case reaches a post-submission state."
      );
    }

    // Una resolucion solo es coherente en el estado terminal del caso.
    if (state === CaseState.RESOLVED && resolution === null) {
      throw new DomainRuleViolationError("A resolved case must contain a resolution snapshot.");
    }

    if (state !== CaseState.RESOLVED && resolution !== null) {
      throw new DomainRuleViolationError(
        "A non-resolved case cannot already contain a resolution snapshot."
      );
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

    // Guardamos la ciudad final correcta del caso.
    this.finalCityId = finalCityId;

    // Guardamos el presupuesto restante de tiempo.
    this.remainingTime = remainingTime;

    // Guardamos el historial de viajes inicial o reconstruido.
    this.travelHistory = travelHistory.map((travelEntry) => ({ ...travelEntry }));

    // Guardamos las locaciones ya visitadas.
    this.visitedLocationIds = [...visitedLocationIds];

    // Guardamos las pistas ya recolectadas.
    this.collectedClues = [...collectedClues];

    // Guardamos la warrant si existe.
    this.warrant = warrant;

    // Guardamos la resolucion si el caso ya termino.
    this.resolution = resolution === null ? null : { ...resolution };

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
    finalCity,
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
      finalCityId: finalCity.id,
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
   * Este metodo modela el desplazamiento entre ciudades conectadas.
   * El aggregate valida el origen actual, la conectividad y el costo temporal.
   */
  travelToCity(destinationCityId: string): void {
    // El viaje esta permitido durante investigacion y tambien en fases posteriores de persecucion.
    this.ensureStateIsOneOf(
      [CaseState.INVESTIGATING, CaseState.WARRANT_ISSUED, CaseState.CHASE],
      "Cities can only be traveled while the case is active."
    );

    // Resolvemos la ciudad actual porque las conexiones validas dependen de ella.
    const currentCity = this.getCurrentCity();

    // Viajar a la misma ciudad no cambia estado y solo agregaria ruido semantico.
    if (destinationCityId === currentCity.id) {
      throw new DomainRuleViolationError("The agent is already in the selected city.");
    }

    // Buscamos una conexion explicita desde la ciudad actual hacia la solicitada.
    const travelConnection = currentCity.connections.find(
      (connection) => connection.destinationCityId === destinationCityId
    );

    // Si no existe conexion, el viaje viola el mapa del caso definido por el dominio.
    if (!travelConnection) {
      throw new DomainRuleViolationError(
        "The selected destination cannot be reached from the current city."
      );
    }

    // Aunque exista la conexion fisica, el jugador solo puede seguir rutas ya descubiertas o conocidas.
    if (!this.getKnownTravelDestinationIdsForCurrentCity().has(destinationCityId)) {
      throw new DomainRuleViolationError(
        "The selected destination is not supported by discovered route evidence."
      );
    }

    // Resolvemos la ciudad destino para validar identidad y preparar la mutacion.
    const destinationCity = this.getCityById(destinationCityId);

    // Consumimos el tiempo asociado a la conexion elegida antes de mover al agente.
    this.remainingTime = this.remainingTime.spend(travelConnection.travelTimeHours);

    // Actualizamos la posicion actual del agente dentro del aggregate.
    this.currentCityId = destinationCity.id;

    // Guardamos una entrada explicita del viaje para trazabilidad y futuras vistas.
    this.travelHistory.push({
      fromCityId: currentCity.id,
      toCityId: destinationCity.id,
      travelTimeHours: travelConnection.travelTimeHours
    });

    // Emitimos un evento de dominio para que aplicacion e infraestructura observen el viaje.
    this.recordDomainEvent({
      type: "CityTraveled",
      caseId: this.id.value,
      fromCityId: currentCity.id,
      toCityId: destinationCity.id,
      travelTimeHours: travelConnection.travelTimeHours,
      remainingTimeHours: this.remainingTime.value
    });

    // Si el tiempo se agotó exactamente con este movimiento, el caso termina por escape.
    if (this.remainingTime.value === 0) {
      this.resolveAsEscape(CaseResolutionCause.TIME_EXPIRED);
      return;
    }

    // Cuando la warrant ya fue emitida y se alcanza la ciudad final, la investigacion entra en persecucion.
    if (this.state === CaseState.WARRANT_ISSUED && destinationCity.id === this.finalCityId) {
      this.state = CaseState.CHASE;
    }

    // Si aun queda tiempo pero ya no alcanza para ninguna accion valida, el caso tambien termina.
    this.resolveAsEscapeIfNoFurtherActionCanBePaid();
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

    // Si el tiempo se agotó exactamente con esta accion, el caso termina por escape.
    if (this.remainingTime.value === 0) {
      this.resolveAsEscape(CaseResolutionCause.TIME_EXPIRED);
      return;
    }

    // Tambien cerramos el caso si la visita deja un presupuesto inutilizable para seguir jugando.
    this.resolveAsEscapeIfNoFurtherActionCanBePaid();
  }

  /**
   * Este metodo registra la hipotesis legal del jugador como una warrant comprometida.
   * En este slice la lista completa de rasgos de `Cipher` funciona como conjunto requerido
   * para la captura final, por eso canonizamos la orden contra los traits del objetivo.
   */
  submitWarrant(warrant: Warrant): void {
    // La orden solo puede emitirse mientras el jugador sigue investigando.
    this.ensureStateIs(
      CaseState.INVESTIGATING,
      "A warrant can only be submitted while investigating the case."
    );

    // La API del dominio exige un value object de warrant ya validado.
    if (!(warrant instanceof Warrant)) {
      throw new DomainRuleViolationError("Submitted warrant must be a Warrant instance.");
    }

    // Reforzamos la regla de no reemision aunque la state machine ya la sugiera.
    if (this.warrant !== null) {
      throw new DomainRuleViolationError("A warrant has already been issued for this case.");
    }

    // Construimos un indice de rasgos canonicos del objetivo para validar la orden.
    const targetTraitsByCode = new Map(
      this.target.traits.map((trait) => [trait.code, trait] as const)
    );

    // Rehidratamos la warrant usando solo rasgos conocidos del caso.
    const canonicalSuspectedTraits = warrant.suspectedTraits.map((suspectedTrait) => {
      const canonicalTargetTrait = targetTraitsByCode.get(suspectedTrait.code);

      if (!canonicalTargetTrait) {
        throw new DomainRuleViolationError(
          "Warrant traits must belong to the target profile defined for this case."
        );
      }

      return canonicalTargetTrait;
    });

    const canonicalWarrant = new Warrant({
      suspectedTraits: canonicalSuspectedTraits
    });

    // La deduccion del jugador debe apoyarse en rasgos realmente descubiertos durante la investigacion.
    const discoveredTraitCodes = new Set(
      this.getDiscoveredTraits().map((discoveredTrait) => discoveredTrait.code)
    );

    for (const suspectedTrait of canonicalWarrant.suspectedTraits) {
      if (!discoveredTraitCodes.has(suspectedTrait.code)) {
        throw new DomainRuleViolationError(
          "Warrant traits must be supported by discovered trait evidence."
        );
      }
    }

    // Persistimos la orden seleccionada como parte del estado consistente del aggregate.
    this.warrant = canonicalWarrant;

    // El caso pasa al estado donde la hipotesis ya fue comprometida.
    this.state = CaseState.WARRANT_ISSUED;

    // Si el jugador ya esta en la ciudad final correcta, la persecucion puede comenzar de inmediato.
    if (this.currentCityId === this.finalCityId) {
      this.state = CaseState.CHASE;
    }

    // Emitimos un evento explicito para telemetria, proyecciones y futuros adapters.
    this.recordDomainEvent({
      type: "WarrantIssued",
      caseId: this.id.value,
      suspectedTraitCodes: canonicalWarrant.suspectedTraits.map((trait) => trait.code),
      suspectedTraitLabels: canonicalWarrant.suspectedTraits.map((trait) => trait.label)
    });

    // Si la warrant deja al jugador sin presupuesto para viajar y aun no hay persecucion activa, el caso muere.
    this.resolveAsEscapeIfNoFurtherActionCanBePaid();
  }

  /**
   * Este metodo intenta cerrar el caso con una captura final.
   * Solo puede ejecutarse en `Chase`, cuando el jugador ya viajo bajo warrant hacia la ciudad final.
   */
  attemptArrest(): void {
    // Solo tiene sentido intentar el arresto durante la persecucion final.
    this.ensureStateIs(
      CaseState.CHASE,
      "An arrest can only be attempted during the final chase."
    );

    // Si el jugador intenta cerrar en una ciudad equivocada, `Cipher` escapa.
    if (this.currentCityId !== this.finalCityId) {
      this.resolveAsEscape(CaseResolutionCause.WRONG_CITY);
      return;
    }

    // Si la warrant no coincide con el perfil requerido, el arresto falla legalmente.
    if (!this.doesIssuedWarrantMatchTarget()) {
      this.resolveAsEscape(CaseResolutionCause.WRONG_WARRANT);
      return;
    }

    // Si ciudad y warrant son correctas, el caso termina con captura exitosa.
    this.resolveAsArrestSuccess();
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
      const isVisited = this.visitedLocationIds.includes(location.id);

      return {
        id: location.id,
        name: location.name,
        isVisited,
        clueSummary: isVisited ? location.clue.summary : null
      };
    });

    // Convertimos solo los destinos ya conocidos del nodo actual en opciones legibles para adapters.
    const knownTravelDestinationIds = this.getKnownTravelDestinationIdsForCurrentCity();
    const availableTravelDestinations = currentCity.connections
      .filter((connection) => knownTravelDestinationIds.has(connection.destinationCityId))
      .map((connection) => {
        const destinationCity = this.getCityById(connection.destinationCityId);

        return {
          id: destinationCity.id,
          name: destinationCity.name,
          travelTimeHours: connection.travelTimeHours
        };
      });

    // Expandimos el historial de viajes con nombres legibles para no delegar mapeos a la UI.
    const travelHistory = this.travelHistory.map((travelEntry) => {
      const fromCity = this.getCityById(travelEntry.fromCityId);
      const toCity = this.getCityById(travelEntry.toCityId);

      return {
        ...travelEntry,
        fromCityName: fromCity.name,
        toCityName: toCity.name
      };
    });

    // Expandimos los rasgos deducidos a una estructura plana consumible por adapters.
    const discoveredTraits = this.getDiscoveredTraits().map((trait) => ({
      code: trait.code,
      label: trait.label
    }));

    // Si ya existe una orden, la convertimos en una vista plana para adapters.
    const issuedWarrant =
      this.warrant === null
        ? null
        : {
            suspectedTraits: this.warrant.suspectedTraits.map((trait) => ({
              code: trait.code,
              label: trait.label
            }))
          };

    // Copiamos la resolucion si el caso ya termino para que la UI pueda explicarla.
    const resolution = this.resolution === null ? null : { ...this.resolution };

    // Devolvemos un objeto plano para evitar que la capa de aplicacion exponga entidades completas.
    return {
      caseId: this.id.value,
      state: this.state,
      agentName: this.activeAgent.name,
      agencyName: this.activeAgent.agency,
      targetAlias: this.target.alias,
      discoveredTraits,
      discoveredTraitLabels: discoveredTraits.map((trait) => trait.label),
      artifactName: this.artifact.name,
      artifactOrigin: this.artifact.historicalOrigin,
      currentCityId: currentCity.id,
      currentCityName: currentCity.name,
      remainingTimeHours: this.remainingTime.value,
      issuedWarrant,
      resolution,
      availableLocations,
      availableTravelDestinations,
      visitedLocationNames,
      collectedClues: [...this.collectedClues],
      travelHistory
    };
  }

  /**
   * Este metodo devuelve y limpia los eventos acumulados.
   * El patron permite que la capa de aplicacion controle cuando publicarlos.
   */
  pullDomainEvents(): CaseDomainEvent[] {
    const eventsToPublish = [...this.domainEvents];
    this.domainEvents = [];
    return eventsToPublish;
  }

  /**
   * Este helper resuelve la ciudad actual y falla si el aggregate quedo inconsistente.
   */
  getCurrentCity(): City {
    return this.getCityById(this.currentCityId);
  }

  /**
   * Este helper resuelve cualquier ciudad del caso por id.
   */
  private getCityById(cityId: string): City {
    const city = this.cities.find((candidateCity) => candidateCity.id === cityId);

    if (!city) {
      throw new DomainRuleViolationError("A referenced city could not be resolved from the case state.");
    }

    return city;
  }

  /**
   * Este helper resuelve cualquier locacion del caso por id.
   * Se usa para derivar evidencia descubierta sin exponer la estructura interna a adapters.
   */
  private getLocationById(locationId: string) {
    const location = this.cities
      .flatMap((city) => city.locations)
      .find((candidateLocation) => candidateLocation.id === locationId);

    if (!location) {
      throw new DomainRuleViolationError(
        "A referenced location could not be resolved from the case state."
      );
    }

    return location;
  }

  /**
   * Este helper encapsula la validacion repetida de estado esperado.
   */
  private ensureStateIs(expectedState: CaseState, message: string): void {
    if (this.state !== expectedState) {
      throw new DomainRuleViolationError(message);
    }
  }

  /**
   * Este helper encapsula comandos permitidos en varios estados activos.
   */
  private ensureStateIsOneOf(expectedStates: ReadonlyArray<CaseState>, message: string): void {
    if (!expectedStates.includes(this.state)) {
      throw new DomainRuleViolationError(message);
    }
  }

  /**
   * Este helper compara la warrant emitida con el conjunto de rasgos requeridos del objetivo.
   * En el MVP actual usamos igualdad de conjunto completa para mantener la regla simple y visible.
   */
  private doesIssuedWarrantMatchTarget(): boolean {
    if (this.warrant === null) {
      return false;
    }

    const targetTraitCodes = new Set(this.target.traits.map((trait) => trait.code));
    const warrantTraitCodes = new Set(this.warrant.suspectedTraits.map((trait) => trait.code));

    if (targetTraitCodes.size !== warrantTraitCodes.size) {
      return false;
    }

    for (const targetTraitCode of targetTraitCodes) {
      if (!warrantTraitCodes.has(targetTraitCode)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Este helper reconstruye los rasgos ya deducidos por el jugador a partir de locaciones visitadas.
   * Se deriva del historial real del caso para que la vista publica no filtre informacion oculta.
   */
  private getDiscoveredTraits(): Trait[] {
    const discoveredTraits: Trait[] = [];
    const discoveredTraitCodes = new Set<string>();

    // Recorremos el orden real de visita para preservar una progresion legible en la vista.
    for (const visitedLocationId of this.visitedLocationIds) {
      const visitedLocation = this.getLocationById(visitedLocationId);

      if (visitedLocation.clue.type !== "trait" || !visitedLocation.clue.revealedTrait) {
        continue;
      }

      if (discoveredTraitCodes.has(visitedLocation.clue.revealedTrait.code)) {
        continue;
      }

      discoveredTraits.push(visitedLocation.clue.revealedTrait);
      discoveredTraitCodes.add(visitedLocation.clue.revealedTrait.code);
    }

    return discoveredTraits;
  }

  /**
   * Este helper reconstruye que destinos conoce el jugador desde la ciudad actual.
   * El conocimiento puede venir de pistas visitadas en esta ciudad o del propio historial de viajes.
   */
  private getKnownTravelDestinationIdsForCurrentCity(): Set<string> {
    const currentCity = this.getCurrentCity();
    const knownDestinationCityIds = new Set<string>();

    // Las pistas visitadas en la ciudad actual pueden revelar rutas principales o desvíos plausibles.
    for (const location of currentCity.locations) {
      if (!this.visitedLocationIds.includes(location.id)) {
        continue;
      }

      if (location.clue.revealedDestinationCityId === undefined) {
        continue;
      }

      knownDestinationCityIds.add(location.clue.revealedDestinationCityId);
    }

    // El historial propio del agente tambien revela rutas ya utilizadas en ambos sentidos.
    for (const travelEntry of this.travelHistory) {
      if (travelEntry.fromCityId === currentCity.id) {
        knownDestinationCityIds.add(travelEntry.toCityId);
      }

      if (travelEntry.toCityId === currentCity.id) {
        knownDestinationCityIds.add(travelEntry.fromCityId);
      }
    }

    return knownDestinationCityIds;
  }

  /**
   * Este helper detecta un estado activo donde ya no existe ninguna accion pagable.
   * En ese punto el caso ya no es jugable ni recuperable y debe cerrarse como escape.
   */
  private resolveAsEscapeIfNoFurtherActionCanBePaid(): void {
    // Nunca re-resolvemos un caso terminal ni intervenimos durante el briefing.
    if (this.state === CaseState.BRIEFING || this.state === CaseState.RESOLVED) {
      return;
    }

    // Durante `Chase` el arresto final no consume tiempo, asi que siempre queda una accion valida.
    if (this.state === CaseState.CHASE) {
      return;
    }

    const currentCity = this.getCurrentCity();

    // En cualquier estado activo, viajar solo es viable si al menos una conexion cabe en el presupuesto.
    const knownTravelDestinationIds = this.getKnownTravelDestinationIdsForCurrentCity();
    const canAffordAnyTravel = currentCity.connections.some(
      (connection) =>
        knownTravelDestinationIds.has(connection.destinationCityId) &&
        connection.travelTimeHours <= this.remainingTime.value
    );

    // Durante `WarrantIssued` el unico camino restante es seguir viajando hacia el cierre del caso.
    if (this.state === CaseState.WARRANT_ISSUED) {
      if (!canAffordAnyTravel) {
        this.resolveAsEscape(CaseResolutionCause.TIME_EXPIRED);
      }

      return;
    }

    // Durante investigacion aun se puede seguir si queda una locacion nueva pagable o un viaje posible.
    const canAffordAnyUnvisitedLocation = currentCity.locations.some(
      (location) =>
        !this.visitedLocationIds.includes(location.id) &&
        LOCATION_VISIT_TIME_COST_HOURS <= this.remainingTime.value
    );

    if (!canAffordAnyUnvisitedLocation && !canAffordAnyTravel) {
      this.resolveAsEscape(CaseResolutionCause.TIME_EXPIRED);
    }
  }

  /**
   * Este helper cierra el caso con captura exitosa.
   */
  private resolveAsArrestSuccess(): void {
    this.state = CaseState.RESOLVED;
    this.resolution = {
      outcome: CaseResolutionOutcome.ARRESTED,
      cause: CaseResolutionCause.ARREST_SUCCESS,
      summary: "Cipher was arrested in the correct city with a valid warrant."
    };

    this.recordDomainEvent({
      type: "CaseResolved",
      caseId: this.id.value,
      outcome: this.resolution.outcome,
      cause: this.resolution.cause,
      currentCityId: this.currentCityId,
      remainingTimeHours: this.remainingTime.value
    });
  }

  /**
   * Este helper cierra el caso con escape de `Cipher`.
   */
  private resolveAsEscape(cause: EscapeResolutionCause): void {
    this.state = CaseState.RESOLVED;
    this.resolution = {
      outcome: CaseResolutionOutcome.ESCAPED,
      cause,
      summary: this.buildEscapeSummary(cause)
    };

    this.recordDomainEvent({
      type: "CaseResolved",
      caseId: this.id.value,
      outcome: this.resolution.outcome,
      cause: this.resolution.cause,
      currentCityId: this.currentCityId,
      remainingTimeHours: this.remainingTime.value
    });

    this.recordDomainEvent({
      type: "CipherEscaped",
      caseId: this.id.value,
      cause,
      currentCityId: this.currentCityId
    });
  }

  /**
   * Este helper construye mensajes de resolucion legibles y estables.
   */
  private buildEscapeSummary(cause: EscapeResolutionCause): string {
    switch (cause) {
      case CaseResolutionCause.TIME_EXPIRED:
        return "Cipher escaped because the remaining time budget no longer allowed a valid action.";
      case CaseResolutionCause.WRONG_CITY:
        return "Cipher escaped because the arrest was attempted in the wrong city.";
      case CaseResolutionCause.WRONG_WARRANT:
        return "Cipher escaped because the warrant did not match the required target traits.";
    }
  }

  /**
   * Este helper agrega eventos al buffer interno del aggregate.
   */
  private recordDomainEvent(domainEvent: CaseDomainEvent): void {
    this.domainEvents.push({ ...domainEvent });
  }
}
