/**
 * Este archivo implementa un `RandomnessProvider` determinista basado en `seed`.
 * Vive en infraestructura porque convierte una necesidad abstracta de la aplicacion
 * en una estrategia concreta de seleccion reproducible para generacion procedural y tests.
 */
import { RandomnessProvider } from "@cipher/contracts";

/**
 * Este helper transforma texto en un entero positivo estable.
 * No busca criptografia; solo una dispersion suficientemente consistente para el MVP.
 */
function hashTextToPositiveInteger(text: string): number {
  // Partimos de una base fija para que el mismo texto produzca siempre el mismo hash.
  let hash = 2166136261;

  // Recorremos cada caracter para mezclarlo dentro del acumulador.
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  // Convertimos el resultado a entero positivo sin signo.
  return hash >>> 0;
}

/**
 * Este helper expone el hash como token hexadecimal corto.
 * Se usa para ids reproducibles sin exponer directamente la `seed` original.
 */
export function createStableSeedToken(seed: string, scopeKey: string): string {
  return hashTextToPositiveInteger(`${seed}::${scopeKey}`).toString(16);
}

export class DeterministicRandomnessProvider extends RandomnessProvider {
  private readonly normalizedSeed: string;

  /**
   * El constructor fija la `seed` que gobernara todas las elecciones del provider.
   */
  constructor(seed: string) {
    super();

    // Normalizamos la semilla para que espacios accidentales no cambien todo el caso.
    this.normalizedSeed = seed.trim();
  }

  /**
   * Este metodo devuelve un entero reproducible dentro del rango pedido.
   */
  nextInteger(minInclusive: number, maxExclusive: number, scopeKey: string): number {
    // El rango debe ser valido para que la operacion tenga sentido semantico.
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error("RandomnessProvider.nextInteger requires whole-number bounds.");
    }

    if (maxExclusive <= minInclusive) {
      throw new Error("RandomnessProvider.nextInteger requires maxExclusive to be greater than minInclusive.");
    }

    // Mezclamos seed y scope para que cada decision tenga su propio espacio estable.
    const hashedValue = hashTextToPositiveInteger(
      `${this.normalizedSeed}::${scopeKey}::${minInclusive}::${maxExclusive}`
    );

    const availableValues = maxExclusive - minInclusive;
    return minInclusive + (hashedValue % availableValues);
  }

  /**
   * Este metodo elige un elemento estable de una lista.
   */
  pickOne<T>(values: ReadonlyArray<T>, scopeKey: string): T {
    // No existe una eleccion valida sobre una lista vacia.
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("RandomnessProvider.pickOne requires a non-empty value list.");
    }

    // Convertimos el hash a un indice reproducible dentro de la lista.
    const selectedIndex = this.nextInteger(0, values.length, scopeKey);
    return values[selectedIndex];
  }

  /**
   * Este metodo elige varios elementos unicos manteniendo reproducibilidad.
   */
  pickMany<T>(values: ReadonlyArray<T>, count: number, scopeKey: string): T[] {
    // Exigimos un conteo entero y positivo para mantener la API simple.
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("RandomnessProvider.pickMany requires a positive whole-number count.");
    }

    // No podemos pedir mas valores unicos que los existentes.
    if (!Array.isArray(values) || count > values.length) {
      throw new Error("RandomnessProvider.pickMany cannot pick more unique values than available.");
    }

    // Trabajamos sobre una copia mutable para ir extrayendo elementos sin repetirlos.
    const remainingValues = [...values];
    const selectedValues: T[] = [];

    // Cada iteracion usa un `scope` derivado para producir una secuencia estable de picks.
    for (let selectionIndex = 0; selectionIndex < count; selectionIndex += 1) {
      const selectedValueIndex = this.nextInteger(
        0,
        remainingValues.length,
        `${scopeKey}::${selectionIndex}`
      );

      const [selectedValue] = remainingValues.splice(selectedValueIndex, 1);
      selectedValues.push(selectedValue);
    }

    return selectedValues;
  }
}
