/**
 * Este archivo define un contrato minimo de almacenamiento clave-valor para el browser.
 * Existe para que la infraestructura pueda hablar con `localStorage` sin acoplarse
 * al tipo `Storage` del DOM dentro de paquetes que tambien compilan en Node.
 */
export interface BrowserKeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
