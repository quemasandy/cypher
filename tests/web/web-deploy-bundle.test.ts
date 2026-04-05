/**
 * Este archivo prueba el bundle portable del adapter web.
 * Su objetivo es demostrar que el despliegue incremental puede arrancar desde un artefacto
 * reducido y autocontenido, sin depender de servir directamente el monorepo completo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Readable } from "node:stream";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface BundleManifest {
  schemaVersion: number;
  generatedAt: string;
  purpose: string;
  entryPoint: string;
  healthCheckPath: string;
  containerRuntimeFiles: string[];
  includedPaths: string[];
}

interface HealthCheckPayload {
  status: string;
  service: string;
  adapter: string;
  persistence: string;
  serverTime: string;
}

test("Web deploy bundle prepares a portable artifact that boots outside the repo root", async () => {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "cypher-web-bundle-"));
  const deployBundleDirectoryPath = join(temporaryDirectoryPath, "bundle");
  const port = 4181;
  let standardOutputBuffer = "";
  let standardErrorBuffer = "";
  let bundledWebServerProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;

  try {
    await execFileAsync(process.execPath, [
      resolve(process.cwd(), "scripts/prepare-web-deploy-bundle.mjs"),
      "--output",
      deployBundleDirectoryPath
    ], {
      cwd: process.cwd()
    });

    const manifestContents = await readFile(
      join(deployBundleDirectoryPath, "bundle-manifest.json"),
      "utf8"
    );
    const bundleManifest = JSON.parse(manifestContents) as BundleManifest;

    assert.equal(bundleManifest.schemaVersion, 1);
    assert.equal(bundleManifest.entryPoint, "apps/web/dist/server.js");
    assert.equal(bundleManifest.healthCheckPath, "/healthz");
    assert.deepEqual(bundleManifest.containerRuntimeFiles, ["Dockerfile", ".dockerignore"]);
    assert.ok(bundleManifest.includedPaths.includes("packages/infra/dist"));
    assert.ok(bundleManifest.includedPaths.includes("packages/contracts/dist"));

    const dockerfileContents = await readFile(
      join(deployBundleDirectoryPath, "Dockerfile"),
      "utf8"
    );
    const dockerignoreContents = await readFile(
      join(deployBundleDirectoryPath, ".dockerignore"),
      "utf8"
    );

    assert.match(dockerfileContents, /FROM node:20-alpine/);
    assert.match(dockerfileContents, /HEALTHCHECK/);
    assert.match(dockerfileContents, /apps\/web\/dist\/server\.js/);
    assert.match(dockerignoreContents, /bundle-manifest\.json/);
    assert.match(dockerignoreContents, /\*\*\/\*\.map/);

    bundledWebServerProcess = spawn(
      process.execPath,
      [join(deployBundleDirectoryPath, "apps/web/dist/server.js")],
      {
        cwd: deployBundleDirectoryPath,
        env: {
          ...process.env,
          PORT: String(port)
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    bundledWebServerProcess.stdout.on("data", (chunk) => {
      standardOutputBuffer += chunk.toString();
    });

    bundledWebServerProcess.stderr.on("data", (chunk) => {
      standardErrorBuffer += chunk.toString();
    });

    await waitForServerToStart(bundledWebServerProcess, {
      getStandardOutputBuffer: () => standardOutputBuffer,
      getStandardErrorBuffer: () => standardErrorBuffer
    });

    const healthResponse = await fetch(`http://localhost:${port}/healthz`);
    const healthCheckPayload = await healthResponse.json() as HealthCheckPayload;
    const indexResponse = await fetch(`http://localhost:${port}/`);
    const indexHtml = await indexResponse.text();
    const webSessionStorageResponse = await fetch(`http://localhost:${port}/web-session-storage.js`);
    const webSessionStorageJavaScript = await webSessionStorageResponse.text();
    const webCasePresentationResponse = await fetch(`http://localhost:${port}/web-case-presentation.js`);
    const webCasePresentationJavaScript = await webCasePresentationResponse.text();

    assert.equal(healthResponse.status, 200);
    assert.equal(healthCheckPayload.status, "ok");
    assert.equal(healthCheckPayload.service, "cipher-web");
    assert.equal(indexResponse.status, 200);
    assert.match(indexHtml, /Cipher Web Adapter/);
    assert.match(indexHtml, /@cipher\/contracts/);
    assert.match(indexHtml, /@cipher\/infra\/browser/);
    assert.equal(webSessionStorageResponse.status, 200);
    assert.match(webSessionStorageJavaScript, /WEB_SESSION_STORAGE_KEY/);
    assert.equal(webCasePresentationResponse.status, 200);
    assert.match(webCasePresentationJavaScript, /resolvePrimaryActionPlan/);
  } finally {
    bundledWebServerProcess?.kill("SIGTERM");

    if (bundledWebServerProcess) {
      await once(bundledWebServerProcess, "exit");
    }

    await rm(temporaryDirectoryPath, {
      recursive: true,
      force: true
    });
  }
});

async function waitForServerToStart(
  webServerProcess: ChildProcessByStdio<null, Readable, Readable>,
  {
    getStandardOutputBuffer,
    getStandardErrorBuffer
  }: {
    getStandardOutputBuffer: () => string;
    getStandardErrorBuffer: () => string;
  }
): Promise<void> {
  for (let attemptIndex = 0; attemptIndex < 40; attemptIndex += 1) {
    if (getStandardOutputBuffer().includes("Cipher Web is available")) {
      return;
    }

    if (webServerProcess.exitCode !== null) {
      throw new Error(
        `Bundled web server exited before becoming ready. stderr: ${getStandardErrorBuffer()}`
      );
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error(
    `Bundled web server did not become ready in time. stdout: ${getStandardOutputBuffer()} stderr: ${getStandardErrorBuffer()}`
  );
}
