/**
 * Este archivo implementa un adapter compuesto de telemetria.
 * Su rol arquitectonico es permitir que la aplicacion emita una sola llamada
 * a `Telemetry`, mientras infraestructura la replica a varios destinos concretos.
 */
import { Telemetry, type TelemetryPayload } from "@cipher/contracts";

export interface CompositeTelemetryOptions {
  telemetryAdapters: ReadonlyArray<Telemetry>;
}

export class CompositeTelemetry extends Telemetry {
  private readonly telemetryAdapters: ReadonlyArray<Telemetry>;

  /**
   * El constructor recibe la lista de adapters concretos que van a recibir cada evento.
   */
  constructor({ telemetryAdapters }: CompositeTelemetryOptions) {
    super();

    // Copiamos la coleccion para fijar el fan-out al inicio del adapter.
    this.telemetryAdapters = [...telemetryAdapters];
  }

  /**
   * Este metodo reenvia el mismo evento a todos los destinos registrados.
   */
  async track(eventName: string, payload: TelemetryPayload): Promise<void> {
    // Congelamos una copia superficial para que todos los destinos vean la misma carga util.
    const stablePayload = { ...payload };

    for (const telemetryAdapter of this.telemetryAdapters) {
      await telemetryAdapter.track(eventName, stablePayload);
    }
  }
}
