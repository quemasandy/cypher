/**
 * Este archivo protege propiedades basicas del generador procedural por `seed`.
 * Su objetivo didactico es mostrar que la generacion no es una caja negra:
 * puede verificarse por determinismo y por resolubilidad estructural.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ProceduralCaseGenerator } from "@cipher/infra";

// Repetimos aqui el costo fijo de visita para comprobar el presupuesto minimo del caso generado.
const REQUIRED_LOCATION_VISIT_TIME_COST_HOURS = 4;
const REQUIRED_SOLVABLE_VISIT_COUNT = 4;

test("ProceduralCaseGenerator returns the same case for the same seed", () => {
  const proceduralCaseGenerator = new ProceduralCaseGenerator();

  // Generamos dos veces el mismo caso para fijar el contrato de determinismo.
  const firstGeneratedCase = proceduralCaseGenerator.generateFromSeed("deterministic-seed");
  const secondGeneratedCase = proceduralCaseGenerator.generateFromSeed("deterministic-seed");

  assert.deepEqual(firstGeneratedCase.toStatusSnapshot(), secondGeneratedCase.toStatusSnapshot());
});

test("ProceduralCaseGenerator keeps a solvable main route for several seeds", () => {
  const proceduralCaseGenerator = new ProceduralCaseGenerator();
  const seedsUnderCheck = ["route-seed-01", "route-seed-02", "route-seed-03", "route-seed-04"];

  for (const seed of seedsUnderCheck) {
    const generatedCase = proceduralCaseGenerator.generateFromSeed(seed);

    // El generador actual usa cuatro ciudades con orden semantico fijo: apertura, tramo medio, final y desvio.
    const openingCity = generatedCase.cities[0];
    const midpointCity = generatedCase.cities[1];
    const finalCity = generatedCase.cities[2];

    assert.equal(generatedCase.currentCityId, openingCity.id);
    assert.equal(generatedCase.finalCityId, finalCity.id);
    assert.equal(generatedCase.target.traits.length, 2);

    const openingToMidpointConnection = openingCity.connections.find(
      (connection) => connection.destinationCityId === midpointCity.id
    );
    const midpointToFinalConnection = midpointCity.connections.find(
      (connection) => connection.destinationCityId === finalCity.id
    );

    assert.ok(openingToMidpointConnection);
    assert.ok(midpointToFinalConnection);

    // Verificamos que la ruta correcta tenga margen temporal positivo para cuatro visitas clave:
    // ruta y rasgo en la ciudad inicial, y ruta y rasgo en la ciudad intermedia.
    const minimumSolvableTimeHours =
      REQUIRED_LOCATION_VISIT_TIME_COST_HOURS * REQUIRED_SOLVABLE_VISIT_COUNT +
      openingToMidpointConnection.travelTimeHours +
      midpointToFinalConnection.travelTimeHours;

    assert.ok(generatedCase.remainingTime.value > minimumSolvableTimeHours);
  }
});
