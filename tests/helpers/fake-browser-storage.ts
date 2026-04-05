/**
 * Este archivo crea un doble pequeno de storage para pruebas de browser persistence.
 * Vive en `tests/helpers` para reutilizarse sin acoplar las pruebas a `window.localStorage`.
 */
import type { BrowserKeyValueStore } from "@cipher/infra";

export class FakeBrowserStorage implements BrowserKeyValueStore {
  private readonly valuesByKey: Map<string, string>;

  constructor() {
    this.valuesByKey = new Map();
  }

  getItem(key: string): string | null {
    return this.valuesByKey.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.valuesByKey.set(key, value);
  }

  removeItem(key: string): void {
    this.valuesByKey.delete(key);
  }
}
