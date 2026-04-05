/**
 * Este archivo interpreta los argumentos de la CLI.
 * Su rol arquitectonico es mantener el adapter de terminal legible separando
 * la traduccion `argv -> comando de aplicacion` del resto del flujo ejecutable.
 */
import { resolve } from "node:path";

export const CliCommand = Object.freeze({
  HELP: "help",
  DEMO: "demo",
  START: "start",
  STATUS: "status",
  RESUME: "resume",
  VISIT: "visit",
  TRAVEL: "travel",
  WARRANT: "warrant",
  ARREST: "arrest"
} as const);

export type CliCommand = (typeof CliCommand)[keyof typeof CliCommand];

const KNOWN_COMMANDS = new Set<string>(Object.values(CliCommand));

export interface ParsedCliArguments {
  command: CliCommand;
  seed: string | null;
  caseId: string | null;
  locationId: string | null;
  destinationCityId: string | null;
  traitCodes: string[];
  databaseFilePath: string | null;
  usePersistentStorage: boolean;
}

/**
 * Este helper traduce la lista cruda de argumentos a una estructura mas semantica.
 * La CLI mantiene un parser pequeno y explicito para que el comportamiento sea facil de seguir.
 */
export function parseCliArguments(rawArguments: ReadonlyArray<string>): ParsedCliArguments {
  const positionalArguments: string[] = [];
  let databaseFilePath: string | null = null;

  for (let argumentIndex = 0; argumentIndex < rawArguments.length; argumentIndex += 1) {
    const currentArgument = rawArguments[argumentIndex];

    if (currentArgument === "--db") {
      const nextArgument = rawArguments[argumentIndex + 1];

      if (!nextArgument) {
        throw new Error("The --db flag requires a database file path.");
      }

      databaseFilePath = resolve(nextArgument);
      argumentIndex += 1;
      continue;
    }

    if (currentArgument === "--help" || currentArgument === "-h") {
      return {
        command: CliCommand.HELP,
        seed: null,
        caseId: null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath,
        usePersistentStorage: false
      };
    }

    positionalArguments.push(currentArgument);
  }

  const inferredCommand = inferCommandFromPositionalArguments(positionalArguments);

  switch (inferredCommand) {
    case CliCommand.HELP:
      return {
        command: CliCommand.HELP,
        seed: null,
        caseId: null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath,
        usePersistentStorage: false
      };
    case CliCommand.DEMO:
      return {
        command: CliCommand.DEMO,
        seed: positionalArguments[0] && !KNOWN_COMMANDS.has(positionalArguments[0])
          ? positionalArguments[0]
          : positionalArguments[1] ?? null,
        caseId: null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath,
        // La demo sigue siendo `in-memory` por defecto para preservar el recorrido automatico previo.
        usePersistentStorage: databaseFilePath !== null
      };
    case CliCommand.START:
      return {
        command: CliCommand.START,
        seed: positionalArguments[1] ?? null,
        caseId: null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
    case CliCommand.STATUS:
    case CliCommand.RESUME:
      return {
        command: inferredCommand,
        seed: null,
        caseId: positionalArguments[1] ?? null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
    case CliCommand.VISIT:
      return {
        command: CliCommand.VISIT,
        seed: null,
        caseId: positionalArguments[1] ?? null,
        locationId: positionalArguments[2] ?? null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
    case CliCommand.TRAVEL:
      return {
        command: CliCommand.TRAVEL,
        seed: null,
        caseId: positionalArguments[1] ?? null,
        locationId: null,
        destinationCityId: positionalArguments[2] ?? null,
        traitCodes: [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
    case CliCommand.WARRANT:
      return {
        command: CliCommand.WARRANT,
        seed: null,
        caseId: positionalArguments[1] ?? null,
        locationId: null,
        destinationCityId: null,
        traitCodes:
          positionalArguments[2]?.split(",").map((traitCode) => traitCode.trim()).filter(Boolean) ?? [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
    case CliCommand.ARREST:
      return {
        command: CliCommand.ARREST,
        seed: null,
        caseId: positionalArguments[1] ?? null,
        locationId: null,
        destinationCityId: null,
        traitCodes: [],
        databaseFilePath: databaseFilePath ?? getDefaultCliDatabaseFilePath(),
        usePersistentStorage: true
      };
  }
}

/**
 * Este helper devuelve la ruta por defecto del archivo local-first de la CLI.
 * Se mantiene estable entre ejecuciones para que `start`, `status` y `visit` puedan encadenarse.
 */
export function getDefaultCliDatabaseFilePath(): string {
  return resolve(process.cwd(), ".local", "cipher-cli.sqlite");
}

/**
 * Este helper imprime una ayuda corta y orientada a la tarea.
 */
export function createCliHelpText(): string {
  const defaultDatabaseFilePath = getDefaultCliDatabaseFilePath();

  return [
    "Cipher CLI",
    "",
    "Usage:",
    "  npm run demo -- [seed]",
    "  npm run demo -- demo [seed] [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- start [seed] [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- status <caseId> [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- resume <caseId> [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- visit <caseId> [locationId] [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- travel <caseId> [cityId] [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- warrant <caseId> [trait-code,trait-code] [--db /absolute/path/cases.sqlite]",
    "  npm run demo -- arrest <caseId> [--db /absolute/path/cases.sqlite]",
    "",
    "Notes:",
    "  - `demo` keeps the previous automatic walkthrough behavior.",
    `  - Command mode defaults to SQLite at ${defaultDatabaseFilePath}.`,
    "  - If `locationId` or `cityId` is omitted, the CLI chooses the first valid option.",
    "  - If warrant trait codes are omitted, the CLI uses all discovered trait evidence."
  ].join("\n");
}

function inferCommandFromPositionalArguments(positionalArguments: ReadonlyArray<string>): CliCommand {
  if (positionalArguments.length === 0) {
    return CliCommand.DEMO;
  }

  const firstPositionalArgument = positionalArguments[0];

  if (KNOWN_COMMANDS.has(firstPositionalArgument)) {
    return firstPositionalArgument as CliCommand;
  }

  // Si el primer argumento no coincide con un comando conocido, lo tratamos como `seed` del demo.
  return CliCommand.DEMO;
}
