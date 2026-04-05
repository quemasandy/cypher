/**
 * Este archivo implementa el primer generador procedural real del proyecto.
 * Vive en infraestructura porque traduce una `seed` en un aggregate concreto usando catalogos,
 * seleccion determinista y validadores, sin contaminar el dominio con detalles de bootstrapping.
 */
import { CaseGenerator } from "@cipher/contracts";
import {
  Agent,
  Artifact,
  Case,
  CaseId,
  Cipher,
  City,
  CityConnection,
  Location,
  TimeBudgetHours,
  Trait
} from "@cipher/domain";
import {
  DeterministicRandomnessProvider,
  createStableSeedToken
} from "./deterministic-randomness-provider.js";

// El aggregate hoy consume 4 horas por visita. Repetimos la constante aqui para que
// el validador de tiempo pueda razonar sobre el caso generado sin acoplarse a internals privados.
const REQUIRED_LOCATION_VISIT_TIME_COST_HOURS = 4;

// El walkthrough actual requiere inspeccionar dos locaciones clave en apertura y dos en tramo medio:
// una de ruta y una de rasgo en cada ciudad, antes de emitir la warrant correctamente.
const REQUIRED_SOLVABLE_VISIT_COUNT = 4;

interface AgentTemplate {
  idStem: string;
  name: string;
}

interface ArtifactTemplate {
  id: string;
  name: string;
  historicalOrigin: string;
}

interface TraitTemplate {
  code: string;
  label: string;
  clueFragment: string;
}

interface CityTemplate {
  id: string;
  name: string;
  routeLocationName: string;
  traitLocationName: string;
  noiseLocationName: string;
}

interface GeneratedCaseBlueprint {
  seed: string;
  caseId: string;
  agent: AgentTemplate;
  artifact: ArtifactTemplate;
  openingCity: CityTemplate;
  midpointCity: CityTemplate;
  finalCity: CityTemplate;
  decoyCity: CityTemplate;
  targetTraits: [TraitTemplate, TraitTemplate];
  openingToMidpointTravelHours: number;
  midpointToFinalTravelHours: number;
  openingToDecoyTravelHours: number;
  midpointToDecoyTravelHours: number;
  timeBudgetHours: number;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  { idStem: "vega", name: "Agent Vega" },
  { idStem: "ibarra", name: "Agent Ibarra" },
  { idStem: "salazar", name: "Agent Salazar" },
  { idStem: "campos", name: "Agent Campos" }
];

const ARTIFACT_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "sun-tablet",
    name: "Tablet of the First Eclipse",
    historicalOrigin: "Recovered from an Andean ceremonial complex."
  },
  {
    id: "obsidian-mask",
    name: "Obsidian Mask",
    historicalOrigin: "Recovered from a ceremonial coastal dig."
  },
  {
    id: "amber-astrolabe",
    name: "Amber Astrolabe",
    historicalOrigin: "Recovered from a shipwreck linked to a lost observatory."
  },
  {
    id: "jade-ledger",
    name: "Jade Ledger",
    historicalOrigin: "Recovered from a collapsed monastic archive."
  }
];

const TRAIT_TEMPLATES: TraitTemplate[] = [
  {
    code: "travels-light",
    label: "Travels light",
    clueFragment: "carried only a slim leather case and refused extra luggage"
  },
  {
    code: "prefers-night-trains",
    label: "Prefers night trains",
    clueFragment: "booked departures just after dusk and avoided morning departures"
  },
  {
    code: "uses-coded-messages",
    label: "Uses coded messages",
    clueFragment: "left behind notes written in substitution ciphers"
  },
  {
    code: "collects-rare-books",
    label: "Collects rare books",
    clueFragment: "kept asking for restricted catalogs of rare and damaged books"
  },
  {
    code: "avoids-cameras",
    label: "Avoids cameras",
    clueFragment: "walked through blind spots and covered reflective surfaces"
  },
  {
    code: "wears-silk-gloves",
    label: "Wears silk gloves",
    clueFragment: "handled every object with pale silk gloves even in the heat"
  }
];

const CITY_TEMPLATES: CityTemplate[] = [
  {
    id: "quito",
    name: "Quito",
    routeLocationName: "National Archive",
    traitLocationName: "Hilltop Rail Office",
    noiseLocationName: "Embassy Garage"
  },
  {
    id: "lima",
    name: "Lima",
    routeLocationName: "Harbor Warehouse",
    traitLocationName: "Rare Book Arcade",
    noiseLocationName: "Consular Loading Dock"
  },
  {
    id: "santiago",
    name: "Santiago",
    routeLocationName: "Observatory Hotel",
    traitLocationName: "Night Train Yard",
    noiseLocationName: "Private Airstrip Hangar"
  },
  {
    id: "bogota",
    name: "Bogota",
    routeLocationName: "Telegraph Exchange",
    traitLocationName: "Restoration Library",
    noiseLocationName: "Diplomatic Garage"
  },
  {
    id: "la-paz",
    name: "La Paz",
    routeLocationName: "Mountain Customs House",
    traitLocationName: "Nocturnal Depot",
    noiseLocationName: "Courier Workshop"
  },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    routeLocationName: "Riverfront Bonded Storehouse",
    traitLocationName: "Antiquarian Gallery",
    noiseLocationName: "Closed Film Studio"
  }
];

/**
 * Este helper redacta una pista de ruta apuntando a la siguiente ciudad correcta.
 */
function createRouteClueSummary(
  artifactName: string,
  sourceCityName: string,
  destinationCityName: string
): string {
  return `${sourceCityName} logistics staff traced movement around ${artifactName} toward ${destinationCityName}.`;
}

/**
 * Este helper redacta una pista de rasgo usando el fragmento semantico del catalogo.
 */
function createTraitClueSummary(traitTemplate: TraitTemplate): string {
  return `Witnesses agree the suspect ${traitTemplate.clueFragment}.`;
}

/**
 * Este helper redacta una pista de ruido que abre una rama plausible pero secundaria.
 */
function createNoiseClueSummary(decoyCityName: string): string {
  return `A rushed informant insisted the trail might continue through ${decoyCityName}, but the report lacked corroboration.`;
}

/**
 * Este helper encapsula la seleccion determinista del blueprint antes de crear entidades.
 */
function createBlueprint(seed: string): GeneratedCaseBlueprint {
  const randomnessProvider = new DeterministicRandomnessProvider(seed);

  // Seleccionamos los elementos narrativos base del caso a partir de catalogos pequenos.
  const agent = randomnessProvider.pickOne(AGENT_TEMPLATES, "agent");
  const artifact = randomnessProvider.pickOne(ARTIFACT_TEMPLATES, "artifact");
  const selectedCities = randomnessProvider.pickMany(CITY_TEMPLATES, 4, "cities");
  const selectedTraits = randomnessProvider.pickMany(TRAIT_TEMPLATES, 2, "traits");

  // Calculamos costos de viaje controlados. El rango pequeno mantiene el caso explicable.
  const openingToMidpointTravelHours = randomnessProvider.nextInteger(5, 9, "travel:opening-midpoint");
  const midpointToFinalTravelHours = randomnessProvider.nextInteger(4, 8, "travel:midpoint-final");
  const openingToDecoyTravelHours = randomnessProvider.nextInteger(4, 8, "travel:opening-decoy");
  const midpointToDecoyTravelHours = randomnessProvider.nextInteger(3, 7, "travel:midpoint-decoy");

  // Calculamos el minimo costo de la ruta ganadora y luego agregamos un margen didactico.
  const minimumSolvableTimeHours =
    REQUIRED_LOCATION_VISIT_TIME_COST_HOURS * REQUIRED_SOLVABLE_VISIT_COUNT +
    openingToMidpointTravelHours +
    midpointToFinalTravelHours;

  return {
    seed,
    caseId: `generated-${createStableSeedToken(seed, "case-id")}`,
    agent,
    artifact,
    openingCity: selectedCities[0],
    midpointCity: selectedCities[1],
    finalCity: selectedCities[2],
    decoyCity: selectedCities[3],
    targetTraits: [selectedTraits[0], selectedTraits[1]],
    openingToMidpointTravelHours,
    midpointToFinalTravelHours,
    openingToDecoyTravelHours,
    midpointToDecoyTravelHours,
    timeBudgetHours: minimumSolvableTimeHours + 12
  };
}

/**
 * Este validador protege la estructura base del grafo antes de construir el aggregate.
 */
function validateBlueprintStructure(blueprint: GeneratedCaseBlueprint): void {
  const cityIds = [
    blueprint.openingCity.id,
    blueprint.midpointCity.id,
    blueprint.finalCity.id,
    blueprint.decoyCity.id
  ];

  // El caso pierde legibilidad si una misma ciudad cumple varios papeles dentro de la ruta.
  if (new Set(cityIds).size !== cityIds.length) {
    throw new Error("ProceduralCaseGenerator requires four distinct cities per generated case.");
  }

  const traitCodes = blueprint.targetTraits.map((traitTemplate) => traitTemplate.code);

  // Exigimos dos rasgos unicos porque la warrant del MVP ya tiene valor real con mas de una pista.
  if (new Set(traitCodes).size !== traitCodes.length) {
    throw new Error("ProceduralCaseGenerator requires unique target traits.");
  }
}

/**
 * Este validador comprueba que el presupuesto alcance para la linea ganadora.
 */
function validateBlueprintTimeBudget(blueprint: GeneratedCaseBlueprint): void {
  const minimumSolvableTimeHours =
    REQUIRED_LOCATION_VISIT_TIME_COST_HOURS * REQUIRED_SOLVABLE_VISIT_COUNT +
    blueprint.openingToMidpointTravelHours +
    blueprint.midpointToFinalTravelHours;

  // Exigimos margen extra para que una sola decision imperfecta no rompa inmediatamente el caso.
  if (blueprint.timeBudgetHours <= minimumSolvableTimeHours) {
    throw new Error("ProceduralCaseGenerator produced an impossible time budget.");
  }
}

/**
 * Este helper traduce el blueprint a entidades del dominio ya validadas.
 */
function buildCaseFromBlueprint(blueprint: GeneratedCaseBlueprint): Case {
  // Construimos primero los rasgos del objetivo porque las pistas los referencian.
  const targetTraits = blueprint.targetTraits.map(
    (traitTemplate) =>
      new Trait({
        code: traitTemplate.code,
        label: traitTemplate.label
      })
  );

  // La ciudad inicial mezcla una pista verdadera de ruta, una de rasgo y una rama de ruido.
  const openingCity = new City({
    id: blueprint.openingCity.id,
    name: blueprint.openingCity.name,
    locations: [
      new Location({
        id: `${blueprint.openingCity.id}-route-desk`,
        name: blueprint.openingCity.routeLocationName,
        clue: {
          type: "route",
          summary: createRouteClueSummary(
            blueprint.artifact.name,
            blueprint.openingCity.name,
            blueprint.midpointCity.name
          ),
          revealedDestinationCityId: blueprint.midpointCity.id
        }
      }),
      new Location({
        id: `${blueprint.openingCity.id}-trait-desk`,
        name: blueprint.openingCity.traitLocationName,
        clue: {
          type: "trait",
          summary: createTraitClueSummary(blueprint.targetTraits[0]),
          revealedTrait: targetTraits[0]
        }
      }),
      new Location({
        id: `${blueprint.openingCity.id}-noise-desk`,
        name: blueprint.openingCity.noiseLocationName,
        clue: {
          type: "noise",
          summary: createNoiseClueSummary(blueprint.decoyCity.name),
          revealedDestinationCityId: blueprint.decoyCity.id
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: blueprint.midpointCity.id,
        travelTimeHours: blueprint.openingToMidpointTravelHours
      }),
      new CityConnection({
        destinationCityId: blueprint.decoyCity.id,
        travelTimeHours: blueprint.openingToDecoyTravelHours
      })
    ]
  });

  // La ciudad intermedia sostiene la ruta principal hasta la ciudad final.
  const midpointCity = new City({
    id: blueprint.midpointCity.id,
    name: blueprint.midpointCity.name,
    locations: [
      new Location({
        id: `${blueprint.midpointCity.id}-route-desk`,
        name: blueprint.midpointCity.routeLocationName,
        clue: {
          type: "route",
          summary: createRouteClueSummary(
            blueprint.artifact.name,
            blueprint.midpointCity.name,
            blueprint.finalCity.name
          ),
          revealedDestinationCityId: blueprint.finalCity.id
        }
      }),
      new Location({
        id: `${blueprint.midpointCity.id}-trait-desk`,
        name: blueprint.midpointCity.traitLocationName,
        clue: {
          type: "trait",
          summary: createTraitClueSummary(blueprint.targetTraits[1]),
          revealedTrait: targetTraits[1]
        }
      }),
      new Location({
        id: `${blueprint.midpointCity.id}-noise-desk`,
        name: blueprint.midpointCity.noiseLocationName,
        clue: {
          type: "noise",
          summary: createNoiseClueSummary(blueprint.decoyCity.name),
          revealedDestinationCityId: blueprint.decoyCity.id
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: blueprint.finalCity.id,
        travelTimeHours: blueprint.midpointToFinalTravelHours
      }),
      new CityConnection({
        destinationCityId: blueprint.openingCity.id,
        travelTimeHours: blueprint.openingToMidpointTravelHours
      }),
      new CityConnection({
        destinationCityId: blueprint.decoyCity.id,
        travelTimeHours: blueprint.midpointToDecoyTravelHours
      })
    ]
  });

  // La ciudad final existe como destino correcto del caso y conserva al menos una locacion legible.
  const finalCity = new City({
    id: blueprint.finalCity.id,
    name: blueprint.finalCity.name,
    locations: [
      new Location({
        id: `${blueprint.finalCity.id}-final-desk`,
        name: blueprint.finalCity.routeLocationName,
        clue: {
          type: "trait",
          summary: createTraitClueSummary(blueprint.targetTraits[0]),
          revealedTrait: targetTraits[0]
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: blueprint.midpointCity.id,
        travelTimeHours: blueprint.midpointToFinalTravelHours
      })
    ]
  });

  // La ciudad de ruido es jugable, pero su informacion no deberia ser necesaria para ganar.
  const decoyCity = new City({
    id: blueprint.decoyCity.id,
    name: blueprint.decoyCity.name,
    locations: [
      new Location({
        id: `${blueprint.decoyCity.id}-noise-desk`,
        name: blueprint.decoyCity.routeLocationName,
        clue: {
          type: "noise",
          summary: `${blueprint.decoyCity.name} offered a plausible lead, but nothing tied the suspect directly to the stolen artifact.`
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: blueprint.openingCity.id,
        travelTimeHours: blueprint.openingToDecoyTravelHours
      }),
      new CityConnection({
        destinationCityId: blueprint.midpointCity.id,
        travelTimeHours: blueprint.midpointToDecoyTravelHours
      })
    ]
  });

  // Finalmente construimos el aggregate root en `Briefing`.
  return Case.createBriefing({
    id: new CaseId(blueprint.caseId),
    activeAgent: new Agent({
      id: `${blueprint.agent.idStem}-${createStableSeedToken(blueprint.seed, "agent-instance")}`,
      name: blueprint.agent.name,
      agency: "TRACE"
    }),
    target: new Cipher({
      alias: "Cipher",
      traits: targetTraits
    }),
    artifact: new Artifact({
      id: blueprint.artifact.id,
      name: blueprint.artifact.name,
      historicalOrigin: blueprint.artifact.historicalOrigin
    }),
    openingCity,
    finalCity,
    cities: [openingCity, midpointCity, finalCity, decoyCity],
    timeBudgetHours: TimeBudgetHours.fromNumber(blueprint.timeBudgetHours)
  });
}

export class ProceduralCaseGenerator extends CaseGenerator<Case> {
  /**
   * Este metodo construye un caso reproducible completo a partir de una `seed`.
   */
  generateFromSeed(seed: string): Case {
    // La `seed` es la entrada fundamental del pipeline procedural; no aceptamos valores vacios.
    if (typeof seed !== "string" || seed.trim().length === 0) {
      throw new Error("ProceduralCaseGenerator requires a non-empty seed.");
    }

    const normalizedSeed = seed.trim();
    const blueprint = createBlueprint(normalizedSeed);

    // Validamos primero la estructura y luego el budget para fallar con mensajes concretos.
    validateBlueprintStructure(blueprint);
    validateBlueprintTimeBudget(blueprint);

    return buildCaseFromBlueprint(blueprint);
  }
}
