/**
 * Este archivo implementa un adapter de telemetria estructurada sobre un archivo local.
 * Existe para cerrar el primer paso de observabilidad de fase 5 sin introducir servicios remotos:
 * la CLI puede dejar eventos tecnicos durables en formato JSON Lines dentro del filesystem local.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Telemetry, type TelemetryPayload } from "@cipher/contracts";

export interface StructuredTelemetryRecord {
  schemaVersion: 1;
  recordedAt: string;
  source: string;
  eventName: string;
  payload: TelemetryPayload;
}

export interface StructuredFileTelemetryOptions {
  filePath: string;
  source: string;
  now?: () => Date;
}

export class StructuredFileTelemetry extends Telemetry {
  private readonly filePath: string;
  private readonly source: string;
  private readonly now: () => Date;

  /**
   * El constructor fija la ruta de salida y el contexto estable del adapter emisor.
   */
  constructor({ filePath, source, now = () => new Date() }: StructuredFileTelemetryOptions) {
    super();

    // Guardamos la ruta completa para que cada `track` solo se concentre en serializar y anexar.
    this.filePath = filePath;

    // El `source` deja claro desde que adapter o proceso se emitio el registro.
    this.source = source;

    // Permitimos inyectar el tiempo para mantener pruebas deterministicas.
    this.now = now;
  }

  /**
   * Este metodo agrega una linea JSON independiente por cada evento de telemetria.
   */
  async track(eventName: string, payload: TelemetryPayload): Promise<void> {
    const structuredRecord: StructuredTelemetryRecord = {
      schemaVersion: 1,
      recordedAt: this.now().toISOString(),
      source: this.source,
      eventName,
      payload: { ...payload }
    };

    // Creamos el directorio padre en cada llamada para tolerar rutas nuevas o carpetas limpiadas.
    await mkdir(dirname(this.filePath), { recursive: true });

    // Usamos JSON Lines para facilitar append incremental y lectura por scripts simples.
    await appendFile(this.filePath, `${JSON.stringify(structuredRecord)}\n`, "utf8");
  }
}
