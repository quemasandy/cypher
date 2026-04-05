/**
 * Este archivo prueba la telemetria estructurada local-first.
 * Su objetivo es demostrar que infraestructura puede dejar eventos durables en JSON Lines
 * y, al mismo tiempo, replicarlos a otros adapters sin cambiar la capa de aplicacion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CompositeTelemetry,
  InMemoryTelemetry,
  StructuredFileTelemetry,
  type StructuredTelemetryRecord
} from "@cipher/infra";

test("StructuredFileTelemetry appends JSON Lines records with timestamp and source metadata", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-structured-telemetry-"));
  const telemetryFilePath = join(temporaryDirectoryPath, "events.jsonl");
  const recordedTimes = [
    new Date("2026-04-05T14:00:00.000Z"),
    new Date("2026-04-05T14:05:00.000Z")
  ];
  let nowCallCount = 0;
  const structuredFileTelemetry = new StructuredFileTelemetry({
    filePath: telemetryFilePath,
    source: "cli-persistent",
    now: () => recordedTimes[nowCallCount++] ?? recordedTimes.at(-1) ?? new Date(0)
  });

  try {
    await structuredFileTelemetry.track("case_started", {
      caseId: "case-001",
      seed: "tutorial-case-v1"
    });
    await structuredFileTelemetry.track("location_visited", {
      caseId: "case-001",
      locationId: "harbor-warehouse"
    });

    const persistedTelemetryContents = await readFile(telemetryFilePath, "utf8");
    const structuredRecords = parseStructuredTelemetryRecords(persistedTelemetryContents);

    assert.deepEqual(structuredRecords, [
      {
        schemaVersion: 1,
        recordedAt: "2026-04-05T14:00:00.000Z",
        source: "cli-persistent",
        eventName: "case_started",
        payload: {
          caseId: "case-001",
          seed: "tutorial-case-v1"
        }
      },
      {
        schemaVersion: 1,
        recordedAt: "2026-04-05T14:05:00.000Z",
        source: "cli-persistent",
        eventName: "location_visited",
        payload: {
          caseId: "case-001",
          locationId: "harbor-warehouse"
        }
      }
    ]);
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
});

test("CompositeTelemetry fans out the same event to in-memory inspection and JSON Lines storage", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-composite-telemetry-"));
  const telemetryFilePath = join(temporaryDirectoryPath, "events.jsonl");
  const inMemoryTelemetry = new InMemoryTelemetry();
  const structuredFileTelemetry = new StructuredFileTelemetry({
    filePath: telemetryFilePath,
    source: "cli-demo",
    now: () => new Date("2026-04-05T15:00:00.000Z")
  });
  const compositeTelemetry = new CompositeTelemetry({
    telemetryAdapters: [inMemoryTelemetry, structuredFileTelemetry]
  });

  try {
    await compositeTelemetry.track("arrest_attempted", {
      caseId: "case-002",
      currentState: "Chase"
    });

    assert.deepEqual(inMemoryTelemetry.recordedEntries, [
      {
        eventName: "arrest_attempted",
        payload: {
          caseId: "case-002",
          currentState: "Chase"
        }
      }
    ]);

    const persistedTelemetryContents = await readFile(telemetryFilePath, "utf8");
    const structuredRecords = parseStructuredTelemetryRecords(persistedTelemetryContents);

    assert.equal(structuredRecords.length, 1);
    assert.equal(structuredRecords[0].eventName, "arrest_attempted");
    assert.equal(structuredRecords[0].source, "cli-demo");
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
});

function parseStructuredTelemetryRecords(
  persistedTelemetryContents: string
): StructuredTelemetryRecord[] {
  return persistedTelemetryContents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((telemetryLine) => JSON.parse(telemetryLine) as StructuredTelemetryRecord);
}
