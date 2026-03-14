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
    })
  ];

  // Definimos una sola ciudad con una sola locacion para mantener el fixture pequeno y legible.
  const lima = new City({
    id: "lima",
    name: "Lima",
    locations: [
      new Location({
        id: "harbor-warehouse",
        name: "Harbor Warehouse",
        clue: {
          type: "route",
          summary: "Shipping crates point to a fast maritime transfer."
        }
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
    cities: [lima],
    timeBudgetHours: TimeBudgetHours.fromNumber(48)
  });
}
