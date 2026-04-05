/**
 * Este archivo crea un fixture puro de dominio para pruebas.
 * Vive fuera de `infra` para que los tests del dominio no dependan
 * de adapters concretos ni de preocupaciones de bootstrapping.
 */
import {
  Agent,
  Artifact,
  Case,
  CaseId,
  Cipher,
  CityConnection,
  City,
  Location,
  TimeBudgetHours,
  Trait
} from "@cipher/domain";

export function createBriefingCaseFixture(): Case {
  // Definimos un rasgo base del objetivo para que el fixture tenga semantica de investigacion.
  const targetTraits = [
    new Trait({
      code: "travels-light",
      label: "Travels light"
    }),
    new Trait({
      code: "prefers-night-trains",
      label: "Prefers night trains"
    })
  ];

  // Definimos la ciudad inicial con una locacion y una salida explicita hacia el siguiente nodo.
  const lima = new City({
    id: "lima",
    name: "Lima",
    locations: [
      new Location({
        id: "harbor-warehouse",
        name: "Harbor Warehouse",
        clue: {
          type: "route",
          summary: "Shipping crates point to a fast maritime transfer.",
          revealedDestinationCityId: "santiago"
        }
      }),
      new Location({
        id: "rail-office",
        name: "Rail Office",
        clue: {
          type: "trait",
          summary: "Ticket clerks remember a suspect traveling with almost no luggage.",
          revealedTrait: targetTraits[0]
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: "santiago",
        travelTimeHours: 6
      })
    ]
  });

  // Definimos una segunda ciudad conectada para poder probar el loop de navegacion.
  const santiago = new City({
    id: "santiago",
    name: "Santiago",
    locations: [
      new Location({
        id: "observatory-platform",
        name: "Observatory Platform",
        clue: {
          type: "route",
          summary: "Station staff prepared a priority corridor toward Bogota.",
          revealedDestinationCityId: "bogota"
        }
      }),
      new Location({
        id: "night-train-yard",
        name: "Night Train Yard",
        clue: {
          type: "trait",
          summary: "Workers remember a suspect choosing only late-night departures.",
          revealedTrait: targetTraits[1]
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: "lima",
        travelTimeHours: 6
      }),
      new CityConnection({
        destinationCityId: "bogota",
        travelTimeHours: 5
      })
    ]
  });

  // Definimos una tercera ciudad para distinguir entre un viaje invalido y uno simplemente aun no disponible.
  const bogota = new City({
    id: "bogota",
    name: "Bogota",
    locations: [
      new Location({
        id: "embassy-garage",
        name: "Embassy Garage",
        clue: {
          type: "route",
          summary: "A diplomatic convoy was prepared for a midnight departure.",
          revealedDestinationCityId: "santiago"
        }
      })
    ],
    connections: [
      new CityConnection({
        destinationCityId: "santiago",
        travelTimeHours: 5
      })
    ]
  });

  // Devolvemos el aggregate ya listo para usarse en pruebas.
  return Case.createBriefing({
    id: new CaseId("fixture-case"),
    activeAgent: new Agent({
      id: "trace-agent-02",
      name: "Agent Ibarra",
      agency: "TRACE"
    }),
    target: new Cipher({
      alias: "Cipher",
      traits: targetTraits
    }),
    artifact: new Artifact({
      id: "obsidian-mask",
      name: "Obsidian Mask",
      historicalOrigin: "Recovered from a ceremonial coastal dig."
    }),
    openingCity: lima,
    finalCity: santiago,
    cities: [lima, santiago, bogota],
    timeBudgetHours: TimeBudgetHours.fromNumber(48)
  });
}
