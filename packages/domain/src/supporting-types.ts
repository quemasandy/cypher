/**
 * Este archivo reune las entidades y value objects pequenos del dominio.
 * Se agrupan aqui para que la primera base de codigo siga siendo facil de recorrer
 * sin perder la separacion entre soporte de dominio y aggregate root.
 */
import { DomainRuleViolationError } from "./domain-rule-violation-error.js";

export interface TraitProps {
  code: string;
  label: string;
}

/**
 * `CaseId` encapsula la identidad del aggregate root.
 */
export class CaseId {
  readonly value: string;

  constructor(value: string) {
    // Exigimos un string no vacio para evitar ids ambiguos en repositorios y eventos.
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainRuleViolationError("CaseId must be a non-empty string.");
    }

    // Guardamos la representacion normalizada del identificador.
    this.value = value.trim();
  }
}

/**
 * `Trait` representa una caracteristica util para la futura warrant.
 */
export class Trait {
  readonly code: string;
  readonly label: string;

  constructor({ code, label }: TraitProps) {
    // El `code` sirve como identificador estable y debe ser obligatorio.
    if (typeof code !== "string" || code.trim().length === 0) {
      throw new DomainRuleViolationError("Trait code must be a non-empty string.");
    }

    // La etiqueta visible ayuda a que CLI, tests y futuras UIs muestren el rasgo con claridad.
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new DomainRuleViolationError("Trait label must be a non-empty string.");
    }

    // Persistimos ambas propiedades como parte del valor del rasgo.
    this.code = code.trim();
    this.label = label.trim();
  }
}

export interface WarrantProps {
  suspectedTraits: ReadonlyArray<Trait>;
}

/**
 * `Warrant` representa la hipotesis legal que el jugador decide comprometer.
 * Se modela como value object porque su identidad no importa por separado:
 * lo importante es el conjunto de rasgos que declara.
 */
export class Warrant {
  readonly suspectedTraits: Trait[];

  constructor({ suspectedTraits }: WarrantProps) {
    // Una warrant vacia no expresa ninguna hipotesis util y viola el modelo del juego.
    if (!Array.isArray(suspectedTraits) || suspectedTraits.length === 0) {
      throw new DomainRuleViolationError("Warrant must include at least one suspected trait.");
    }

    // Todas las entradas deben ser value objects `Trait` ya validados.
    if (!suspectedTraits.every((trait) => trait instanceof Trait)) {
      throw new DomainRuleViolationError("Warrant suspected traits must be Trait instances.");
    }

    // Exigimos codigos unicos para que la orden no duplique evidencia semantica.
    const traitCodes = suspectedTraits.map((trait) => trait.code);
    const uniqueTraitCodes = new Set(traitCodes);

    if (uniqueTraitCodes.size !== traitCodes.length) {
      throw new DomainRuleViolationError("Warrant cannot contain duplicated trait codes.");
    }

    // Copiamos los rasgos para evitar mutaciones externas accidentales.
    this.suspectedTraits = [...suspectedTraits];
  }
}

export interface AgentProps {
  id: string;
  name: string;
  agency: string;
}

/**
 * `Agent` representa al detective activo del caso.
 */
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly agency: string;

  constructor({ id, name, agency }: AgentProps) {
    // El identificador del agente permite referenciarlo sin depender del nombre.
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new DomainRuleViolationError("Agent id must be a non-empty string.");
    }

    // El nombre del agente se usa en las vistas y mensajes del caso.
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new DomainRuleViolationError("Agent name must be a non-empty string.");
    }

    // La agencia deja el modelo alineado con el setting de TRACE desde el inicio.
    if (typeof agency !== "string" || agency.trim().length === 0) {
      throw new DomainRuleViolationError("Agent agency must be a non-empty string.");
    }

    // Guardamos el estado validado de la entidad.
    this.id = id.trim();
    this.name = name.trim();
    this.agency = agency.trim();
  }
}

export interface CipherProps {
  alias: string;
  traits: ReadonlyArray<Trait>;
}

/**
 * `Cipher` representa al objetivo central del caso.
 */
export class Cipher {
  readonly alias: string;
  readonly traits: Trait[];

  constructor({ alias, traits }: CipherProps) {
    // El alias del objetivo es parte importante de la fantasia del juego.
    if (typeof alias !== "string" || alias.trim().length === 0) {
      throw new DomainRuleViolationError("Cipher alias must be a non-empty string.");
    }

    // El dominio exige al menos un rasgo para que haya base de investigacion y warrant.
    if (!Array.isArray(traits) || traits.length === 0) {
      throw new DomainRuleViolationError("Cipher must have at least one trait.");
    }

    // Validamos que todos los rasgos sean instancias del value object correcto.
    if (!traits.every((trait) => trait instanceof Trait)) {
      throw new DomainRuleViolationError("Cipher traits must be Trait instances.");
    }

    // Persistimos el alias.
    this.alias = alias.trim();

    // Copiamos el arreglo para no compartir una referencia mutable desde afuera.
    this.traits = [...traits];
  }
}

export interface LocationClue {
  type: string;
  summary: string;
  revealedTrait?: Trait;
  revealedDestinationCityId?: string;
}

export interface LocationProps {
  id: string;
  name: string;
  clue: LocationClue;
}

/**
 * `Location` representa un punto investigable dentro de una ciudad.
 */
export class Location {
  readonly id: string;
  readonly name: string;
  readonly clue: LocationClue;

  constructor({ id, name, clue }: LocationProps) {
    // El id permite relacionar visitas y futuras pistas con un lugar concreto.
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new DomainRuleViolationError("Location id must be a non-empty string.");
    }

    // El nombre del lugar se mostrara directamente en la CLI y futuras UIs.
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new DomainRuleViolationError("Location name must be a non-empty string.");
    }

    // La primera base del codigo ya exige una pista minima por ubicacion.
    if (typeof clue !== "object" || clue === null) {
      throw new DomainRuleViolationError("Location clue must be an object.");
    }

    // El tipo de pista ayuda a preparar la futura clasificacion route/trait/noise.
    if (typeof clue.type !== "string" || clue.type.trim().length === 0) {
      throw new DomainRuleViolationError("Location clue type must be a non-empty string.");
    }

    // El resumen semantico permite mostrar la pista sin exponer una estructura mas compleja todavia.
    if (typeof clue.summary !== "string" || clue.summary.trim().length === 0) {
      throw new DomainRuleViolationError("Location clue summary must be a non-empty string.");
    }

    const normalizedClueType = clue.type.trim();

    // Las pistas de rasgo deben apuntar explicitamente al rasgo que permiten deducir.
    if (normalizedClueType === "trait" && !(clue.revealedTrait instanceof Trait)) {
      throw new DomainRuleViolationError(
        "Trait clues must declare the revealed trait as a Trait instance."
      );
    }

    // Las pistas de otros tipos no deben cargar metadata de rasgo para evitar ambiguedad semantica.
    if (normalizedClueType !== "trait" && clue.revealedTrait !== undefined) {
      throw new DomainRuleViolationError(
        "Only trait clues can declare a revealed trait."
      );
    }

    // Las pistas de ruta deben apuntar explicitamente a una ciudad revelada.
    if (
      normalizedClueType === "route" &&
      (typeof clue.revealedDestinationCityId !== "string" ||
        clue.revealedDestinationCityId.trim().length === 0)
    ) {
      throw new DomainRuleViolationError(
        "Route clues must declare the revealed destination city id."
      );
    }

    // El ruido actual puede revelar una ciudad alternativa, pero otras pistas no deben cargar ese dato.
    if (
      !["route", "noise"].includes(normalizedClueType) &&
      clue.revealedDestinationCityId !== undefined
    ) {
      throw new DomainRuleViolationError(
        "Only route or noise clues can declare a revealed destination city id."
      );
    }

    if (
      clue.revealedDestinationCityId !== undefined &&
      (typeof clue.revealedDestinationCityId !== "string" ||
        clue.revealedDestinationCityId.trim().length === 0)
    ) {
      throw new DomainRuleViolationError(
        "Revealed destination city ids must be non-empty strings."
      );
    }

    // Guardamos el estado validado de la locacion.
    this.id = id.trim();
    this.name = name.trim();
    this.clue = {
      type: normalizedClueType,
      summary: clue.summary.trim(),
      ...(clue.revealedTrait === undefined ? {} : { revealedTrait: clue.revealedTrait }),
      ...(clue.revealedDestinationCityId === undefined
        ? {}
        : { revealedDestinationCityId: clue.revealedDestinationCityId.trim() })
    };
  }
}

export interface CityConnectionProps {
  destinationCityId: string;
  travelTimeHours: number;
}

/**
 * `CityConnection` representa una ruta disponible desde una ciudad hacia otra.
 * Vive como value object pequeno porque el costo de viaje es parte del mapa del caso,
 * no una decision improvisada del caso de uso.
 */
export class CityConnection {
  readonly destinationCityId: string;
  readonly travelTimeHours: number;

  constructor({ destinationCityId, travelTimeHours }: CityConnectionProps) {
    // La conexion debe apuntar a una ciudad destino concreta y referenciable.
    if (typeof destinationCityId !== "string" || destinationCityId.trim().length === 0) {
      throw new DomainRuleViolationError("City connection destination id must be a non-empty string.");
    }

    // El costo de viaje se modela como horas enteras para mantener el MVP discreto.
    if (!Number.isInteger(travelTimeHours) || travelTimeHours <= 0) {
      throw new DomainRuleViolationError("City connection travel time must be a positive whole number.");
    }

    // Persistimos el identificador del destino ya normalizado.
    this.destinationCityId = destinationCityId.trim();

    // Persistimos el costo temporal que consumira el viaje.
    this.travelTimeHours = travelTimeHours;
  }
}

export interface CityProps {
  id: string;
  name: string;
  locations: ReadonlyArray<Location>;
  connections?: ReadonlyArray<CityConnection>;
}

/**
 * `City` agrupa las locaciones disponibles para la investigacion.
 */
export class City {
  readonly id: string;
  readonly name: string;
  readonly locations: Location[];
  readonly connections: CityConnection[];

  constructor({ id, name, locations, connections = [] }: CityProps) {
    // El id de ciudad es obligatorio para el historial de viajes y el estado del caso.
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new DomainRuleViolationError("City id must be a non-empty string.");
    }

    // El nombre de la ciudad sirve como dato de presentacion y de lectura del mapa mental del caso.
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new DomainRuleViolationError("City name must be a non-empty string.");
    }

    // El primer vertical exige al menos una locacion para que la ciudad sea investigable.
    if (!Array.isArray(locations) || locations.length === 0) {
      throw new DomainRuleViolationError("City must contain at least one location.");
    }

    // Verificamos que las locaciones pertenezcan al tipo correcto.
    if (!locations.every((location) => location instanceof Location)) {
      throw new DomainRuleViolationError("City locations must be Location instances.");
    }

    // Las conexiones son opcionales porque una ciudad aislada sigue siendo valida en fixtures minimos.
    if (!Array.isArray(connections)) {
      throw new DomainRuleViolationError("City connections must be provided as an array.");
    }

    // Si existen conexiones, todas deben respetar el value object correcto.
    if (!connections.every((connection) => connection instanceof CityConnection)) {
      throw new DomainRuleViolationError("City connections must be CityConnection instances.");
    }

    // Persistimos la identidad de la ciudad.
    this.id = id.trim();

    // Persistimos el nombre visible.
    this.name = name.trim();

    // Copiamos la lista para evitar mutaciones externas accidentales.
    this.locations = [...locations];

    // Copiamos tambien las conexiones para preservar el borde de la entidad.
    this.connections = [...connections];
  }
}

export interface ArtifactProps {
  id: string;
  name: string;
  historicalOrigin: string;
}

/**
 * `Artifact` representa el objetivo material que motiva el caso.
 */
export class Artifact {
  readonly id: string;
  readonly name: string;
  readonly historicalOrigin: string;

  constructor({ id, name, historicalOrigin }: ArtifactProps) {
    // El id del artefacto sirve como identidad estable del objeto robado.
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new DomainRuleViolationError("Artifact id must be a non-empty string.");
    }

    // El nombre visible del artefacto se usa en briefing y status.
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new DomainRuleViolationError("Artifact name must be a non-empty string.");
    }

    // El origen historico ayuda a enriquecer el mundo desde el primer ejemplo jugable.
    if (typeof historicalOrigin !== "string" || historicalOrigin.trim().length === 0) {
      throw new DomainRuleViolationError("Artifact historical origin must be a non-empty string.");
    }

    // Persistimos los datos ya validados.
    this.id = id.trim();
    this.name = name.trim();
    this.historicalOrigin = historicalOrigin.trim();
  }
}
