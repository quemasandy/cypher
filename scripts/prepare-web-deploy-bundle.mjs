/**
 * Este script prepara un bundle portable del adapter web.
 * Su rol arquitectonico es transformar el monorepo en un artefacto pequeno y ejecutable
 * para despliegue incremental, sin introducir un backend remoto ni romper el enfoque local-first.
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Este listado fija los unicos caminos que el bundle necesita para arrancar.
 * Mantenerlo explicito ayuda a entender por que cada archivo existe en el artefacto final.
 */
const REQUIRED_RELATIVE_PATHS = Object.freeze([
  "apps/web/package.json",
  "apps/web/dist",
  "apps/web/src/index.html",
  "apps/web/src/styles.css",
  "packages/application/dist",
  "packages/contracts/dist",
  "packages/domain/dist",
  "packages/infra/dist"
]);

const scriptDirectoryPath = fileURLToPath(new URL(".", import.meta.url));
const repositoryRootPath = resolve(scriptDirectoryPath, "..");
const dockerTemplateDirectoryPath = resolve(repositoryRootPath, "infra", "docker");
const outputDirectoryPath = resolveOutputDirectoryPath(process.argv.slice(2));

await recreateOutputDirectory(outputDirectoryPath);
await copyRequiredPaths(outputDirectoryPath);
await writeBundleManifest(outputDirectoryPath);
await copyContainerRuntimeFiles(outputDirectoryPath);

console.log(`Prepared Cipher web deploy bundle at ${outputDirectoryPath}`);

function resolveOutputDirectoryPath(rawArguments) {
  let explicitOutputDirectoryPath = null;

  for (let argumentIndex = 0; argumentIndex < rawArguments.length; argumentIndex += 1) {
    const currentArgument = rawArguments[argumentIndex];

    if (currentArgument === "--output") {
      const nextArgument = rawArguments[argumentIndex + 1];

      if (!nextArgument) {
        throw new Error("The --output flag requires a target directory path.");
      }

      explicitOutputDirectoryPath = resolve(repositoryRootPath, nextArgument);
      argumentIndex += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${currentArgument}`);
  }

  return explicitOutputDirectoryPath ?? resolve(repositoryRootPath, ".deploy", "web");
}

async function recreateOutputDirectory(targetDirectoryPath) {
  await rm(targetDirectoryPath, {
    recursive: true,
    force: true
  });
  await mkdir(targetDirectoryPath, {
    recursive: true
  });
}

async function copyRequiredPaths(targetDirectoryPath) {
  for (const requiredRelativePath of REQUIRED_RELATIVE_PATHS) {
    const sourcePath = resolve(repositoryRootPath, requiredRelativePath);
    const targetPath = resolve(targetDirectoryPath, requiredRelativePath);

    // Creamos los directorios intermedios antes de copiar para que el bundle conserve la estructura del repo.
    await mkdir(dirname(targetPath), {
      recursive: true
    });
    await cp(sourcePath, targetPath, {
      recursive: true
    });
  }
}

async function writeBundleManifest(targetDirectoryPath) {
  const bundleManifestPath = resolve(targetDirectoryPath, "bundle-manifest.json");
  const bundleManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: "Portable deploy bundle for the Cipher web adapter.",
    entryPoint: "apps/web/dist/server.js",
    healthCheckPath: "/healthz",
    containerRuntimeFiles: ["Dockerfile", ".dockerignore"],
    includedPaths: REQUIRED_RELATIVE_PATHS
  };

  await writeFile(bundleManifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`, "utf8");
}

async function copyContainerRuntimeFiles(targetDirectoryPath) {
  // Copiamos plantillas estables para que el bundle siga siendo legible y versionable desde `infra/docker`.
  await cp(
    resolve(dockerTemplateDirectoryPath, "web.Dockerfile"),
    resolve(targetDirectoryPath, "Dockerfile")
  );
  await cp(
    resolve(dockerTemplateDirectoryPath, "web.dockerignore"),
    resolve(targetDirectoryPath, ".dockerignore")
  );
}
