/**
 * Este archivo prueba la CLI como adapter de entrada persistido.
 * Su objetivo es demostrar que varios procesos separados pueden continuar el mismo caso
 * usando el mismo archivo `SQLite` sin saltarse la capa de aplicacion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { StructuredTelemetryRecord } from "@cipher/infra";

const execFileAsync = promisify(execFile);

test("CLI commands can resume the same persisted case across separate processes", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-cli-session-"));
  const databaseFilePath = join(temporaryDirectoryPath, "cases.sqlite");
  const telemetryFilePath = join(temporaryDirectoryPath, "cases.telemetry.jsonl");

  try {
    // Primera ejecucion: abrimos un caso nuevo y extraemos el `caseId` devuelto por la CLI.
    const startOutput = await runCliCommand(["start", "tutorial-case-v1", "--db", databaseFilePath]);
    const caseId = extractCaseIdFromCliOutput(startOutput);

    assert.match(startOutput, /^Seed: tutorial-case-v1/m);
    assert.match(startOutput, /^Storage: SQLite/m);
    assert.match(startOutput, /^State: Investigating$/m);
    assert.match(startOutput, /^Current city: Bogota$/m);
    assert.match(
      startOutput,
      new RegExp(`^Structured telemetry file: ${escapeForRegularExpression(telemetryFilePath)}$`, "m")
    );

    // Segunda ejecucion: visitamos la primera locacion pendiente y dejamos visible la ruta.
    const visitOutput = await runCliCommand(["visit", caseId, "--db", databaseFilePath]);

    assert.match(visitOutput, /^=== After Visiting Location ===$/m);
    assert.match(
      visitOutput,
      /Bogota logistics staff traced movement around Amber Astrolabe toward Buenos Aires\./
    );
    assert.match(visitOutput, /^Travel options:$/m);
    assert.match(visitOutput, /- Buenos Aires \(8h\)/);

    // Tercera ejecucion: usamos la ruta persistida para viajar sin volver a empezar el caso.
    const travelOutput = await runCliCommand(["travel", caseId, "--db", databaseFilePath]);

    assert.match(travelOutput, /^=== After Traveling To City ===$/m);
    assert.match(travelOutput, /^Current city: Buenos Aires$/m);
    assert.match(travelOutput, /- Bogota -> Buenos Aires \(8h\)/);

    // Cuarta ejecucion: leemos el estado y comprobamos que la ciudad y el historial siguen ahi.
    const statusOutput = await runCliCommand(["status", caseId, "--db", databaseFilePath]);

    assert.match(statusOutput, /^=== Current Case Status ===$/m);
    assert.match(statusOutput, /^Case ID: /m);
    assert.match(statusOutput, /^Current city: Buenos Aires$/m);
    assert.match(statusOutput, /- Bogota -> Buenos Aires \(8h\)/);

    const persistedTelemetryContents = await readFile(telemetryFilePath, "utf8");
    const structuredTelemetryRecords = parseStructuredTelemetryRecords(persistedTelemetryContents);

    assert.deepEqual(
      structuredTelemetryRecords.map((structuredTelemetryRecord) => structuredTelemetryRecord.eventName),
      ["case_started", "location_visited", "city_traveled"]
    );
    assert.ok(
      structuredTelemetryRecords.every(
        (structuredTelemetryRecord) => structuredTelemetryRecord.source === "cli-persistent"
      )
    );
    assert.equal(structuredTelemetryRecords[0]?.payload.caseId, caseId);
  } finally {
    await rm(temporaryDirectoryPath, { recursive: true, force: true });
  }
});

async function runCliCommand(argumentsForCli: ReadonlyArray<string>): Promise<string> {
  const cliEntryPointPath = resolve(process.cwd(), "apps/cli/dist/index.js");
  const { stdout, stderr } = await execFileAsync(process.execPath, [cliEntryPointPath, ...argumentsForCli], {
    cwd: process.cwd()
  });

  return `${stdout}${stderr}`;
}

function extractCaseIdFromCliOutput(cliOutput: string): string {
  const caseIdMatch = cliOutput.match(/^Case ID: (.+)$/m);

  if (!caseIdMatch?.[1]) {
    throw new Error("CLI output did not include a case id.");
  }

  return caseIdMatch[1].trim();
}

function parseStructuredTelemetryRecords(
  persistedTelemetryContents: string
): StructuredTelemetryRecord[] {
  return persistedTelemetryContents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((telemetryLine) => JSON.parse(telemetryLine) as StructuredTelemetryRecord);
}

function escapeForRegularExpression(rawValue: string): string {
  return rawValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
