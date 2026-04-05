/**
 * Este archivo prueba el adapter web como servidor local.
 * Su objetivo es validar que el paquete `apps/web` exponga HTML, CSS y JS
 * consumibles por un navegador sin depender de un runner visual externo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import type { Readable } from "node:stream";

interface HealthCheckPayload {
  status: string;
  service: string;
  adapter: string;
  persistence: string;
  serverTime: string;
}

test("Web server serves the local adapter shell and browser-safe modules", async () => {
  const port = 4179;
  let standardOutputBuffer = "";
  let standardErrorBuffer = "";
  const webServerProcess = spawn(process.execPath, ["apps/web/dist/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  webServerProcess.stdout.on("data", (chunk) => {
    standardOutputBuffer += chunk.toString();
  });

  webServerProcess.stderr.on("data", (chunk) => {
    standardErrorBuffer += chunk.toString();
  });

  try {
    await waitForServerToStart(webServerProcess, {
      getStandardOutputBuffer: () => standardOutputBuffer,
      getStandardErrorBuffer: () => standardErrorBuffer
    });

    const indexResponse = await fetch(`http://localhost:${port}/`);
    const indexHtml = await indexResponse.text();

    assert.equal(indexResponse.status, 200);
    assert.match(indexHtml, /Cipher Web Adapter/);
    assert.match(indexHtml, /@cipher\/application/);
    assert.match(indexHtml, /@cipher\/contracts/);
    assert.match(indexHtml, /id="app"/);

    const healthResponse = await fetch(`http://localhost:${port}/healthz`);
    const healthCheckPayload = await healthResponse.json() as HealthCheckPayload;

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthCheckPayload.status, "ok");
    assert.deepEqual(healthCheckPayload.service, "cipher-web");
    assert.deepEqual(healthCheckPayload.adapter, "web-local");
    assert.deepEqual(healthCheckPayload.persistence, "browser-localStorage");
    assert.equal(typeof healthCheckPayload.serverTime, "string");

    const stylesResponse = await fetch(`http://localhost:${port}/styles.css`);
    const stylesCss = await stylesResponse.text();

    assert.equal(stylesResponse.status, 200);
    assert.match(stylesCss, /--paper:/);
    assert.match(stylesCss, /\.hero/);
    assert.match(stylesCss, /\.report-preview/);
    assert.match(stylesCss, /\.feedback-banner/);

    const appResponse = await fetch(`http://localhost:${port}/app.js`);
    const appJavaScript = await appResponse.text();
    const webSessionStorageResponse = await fetch(`http://localhost:${port}/web-session-storage.js`);
    const webSessionStorageJavaScript = await webSessionStorageResponse.text();
    const webCasePresentationResponse = await fetch(`http://localhost:${port}/web-case-presentation.js`);
    const webCasePresentationJavaScript = await webCasePresentationResponse.text();

    assert.equal(appResponse.status, 200);
    assert.match(appJavaScript, /render_game_to_text/);
    assert.match(appJavaScript, /StartCase/);
    assert.match(appJavaScript, /localStorage/);
    assert.match(appJavaScript, /copyInvestigationReport/);
    assert.match(appJavaScript, /toggleFullscreen/);
    assert.equal(webSessionStorageResponse.status, 200);
    assert.match(webSessionStorageJavaScript, /savePersistedWebSessionSnapshot/);
    assert.equal(webCasePresentationResponse.status, 200);
    assert.match(webCasePresentationJavaScript, /createInvestigationReport/);

    const browserInfraResponse = await fetch(`http://localhost:${port}/packages/infra/dist/browser.js`);
    const browserInfraJavaScript = await browserInfraResponse.text();
    const contractsResponse = await fetch(`http://localhost:${port}/packages/contracts/dist/index.js`);
    const contractsJavaScript = await contractsResponse.text();

    assert.equal(browserInfraResponse.status, 200);
    assert.match(browserInfraJavaScript, /LocalStorageCaseRepository/);
    assert.doesNotMatch(browserInfraJavaScript, /sqlite-case-repository/);
    assert.equal(contractsResponse.status, 200);
    assert.match(contractsJavaScript, /export class Telemetry/);

    await waitForStandardOutputToInclude(() => standardOutputBuffer, '"kind":"web_server_started"');
    await waitForStandardOutputToInclude(() => standardOutputBuffer, '"path":"/healthz"');
    assert.match(standardOutputBuffer, /"kind":"web_request_completed"/);
  } finally {
    webServerProcess.kill("SIGTERM");
    await once(webServerProcess, "exit");
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
        `Web server exited before becoming ready. stderr: ${getStandardErrorBuffer()}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Web server did not become ready in time. stdout: ${getStandardOutputBuffer()} stderr: ${getStandardErrorBuffer()}`
  );
}

async function waitForStandardOutputToInclude(
  getStandardOutputBuffer: () => string,
  expectedSnippet: string
): Promise<void> {
  for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
    if (getStandardOutputBuffer().includes(expectedSnippet)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Expected stdout to include ${expectedSnippet}, but it never appeared.`);
}
