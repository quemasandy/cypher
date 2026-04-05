/**
 * Este archivo implementa un servidor local minimo para el adapter web.
 * Vive en `apps/web` porque su trabajo no es modelar el juego, sino exponer
 * assets HTML/CSS/JS compilados y los paquetes compartidos del monorepo al navegador.
 * En esta fase tambien concentra la operabilidad basica del despliegue incremental:
 * health check, logs estructurados y configuracion explicita de arranque.
 */
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectoryPath = fileURLToPath(new URL(".", import.meta.url));
const repositoryRootPath = resolve(currentDirectoryPath, "../../..");
const webSourceDirectoryPath = resolve(repositoryRootPath, "apps/web/src");
const webDistDirectoryPath = resolve(repositoryRootPath, "apps/web/dist");
const packagesDirectoryPath = resolve(repositoryRootPath, "packages");

interface WebServerRuntimeConfiguration {
  host: string | null;
  port: number;
}

interface ResponseDescriptor {
  statusCode: number;
  contentType: string;
}

interface HealthCheckResponse {
  status: "ok";
  service: "cipher-web";
  adapter: "web-local";
  persistence: "browser-localStorage";
  serverTime: string;
}

/**
 * Este helper resuelve el puerto del server local.
 * Lo mantenemos pequeno y predecible para que el README y las pruebas del skill usen la misma URL.
 */
function resolvePort(): number {
  const rawPortFromEnvironment = process.env.PORT;

  if (!rawPortFromEnvironment) {
    return 4173;
  }

  const parsedPort = Number.parseInt(rawPortFromEnvironment, 10);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4173;
}

/**
 * Este helper permite fijar un host de bind cuando el despliegue lo necesita.
 * Si no hay `HOST`, dejamos que Node use su comportamiento por defecto para no
 * volver mas fragil la ejecucion local ni las pruebas del repositorio.
 */
function resolveHost(): string | null {
  const rawHostFromEnvironment = process.env.HOST?.trim();
  return rawHostFromEnvironment && rawHostFromEnvironment.length > 0
    ? rawHostFromEnvironment
    : null;
}

function getContentTypeFromExtension(fileExtension: string): string {
  switch (fileExtension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

/**
 * Este helper protege el server de path traversal y restringe que archivos son servibles.
 */
function resolveFilePathFromRequestPath(requestPathname: string): string | null {
  const normalizedRequestPathname = normalize(requestPathname);

  if (normalizedRequestPathname === "/" || normalizedRequestPathname === "/index.html") {
    return join(webSourceDirectoryPath, "index.html");
  }

  if (normalizedRequestPathname === "/styles.css") {
    return join(webSourceDirectoryPath, "styles.css");
  }

  if (normalizedRequestPathname.startsWith("/packages/")) {
    return join(repositoryRootPath, normalizedRequestPathname.slice(1));
  }

  // El adapter web ya no compila a un solo archivo.
  // Servimos cualquier modulo JS o sourcemap emitido en `apps/web/dist`
  // para que los imports relativos del browser funcionen sin bundler adicional.
  if (
    normalizedRequestPathname.endsWith(".js") ||
    normalizedRequestPathname.endsWith(".js.map")
  ) {
    return join(webDistDirectoryPath, normalizedRequestPathname.slice(1));
  }

  return null;
}

function createHealthCheckResponse(): HealthCheckResponse {
  return {
    status: "ok",
    service: "cipher-web",
    adapter: "web-local",
    persistence: "browser-localStorage",
    serverTime: new Date().toISOString()
  };
}

/**
 * Este helper centraliza el formato JSONL de logs del server.
 * Usamos stdout porque es el canal mas portable para un despliegue pequeno.
 */
function writeStructuredServerLog(logPayload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      recordedAt: new Date().toISOString(),
      ...logPayload
    })
  );
}

function sendTextResponse(
  response: ServerResponse,
  statusCode: number,
  message: string
): ResponseDescriptor {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(message);

  return {
    statusCode,
    contentType: "text/plain; charset=utf-8"
  };
}

function sendJsonResponse(
  response: ServerResponse,
  statusCode: number,
  jsonPayload: object
): ResponseDescriptor {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(jsonPayload));

  return {
    statusCode,
    contentType: "application/json; charset=utf-8"
  };
}

async function sendFileResponse(
  response: ServerResponse,
  resolvedFilePath: string
): Promise<ResponseDescriptor> {
  try {
    const fileBuffer = await readFile(resolvedFilePath);
    const contentType = getContentTypeFromExtension(extname(resolvedFilePath));

    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store"
    });
    response.end(fileBuffer);

    return {
      statusCode: 200,
      contentType
    };
  } catch {
    return sendTextResponse(response, 404, "Not found.");
  }
}

function resolveRuntimeConfiguration(): WebServerRuntimeConfiguration {
  return {
    host: resolveHost(),
    port: resolvePort()
  };
}

async function handleRequest(
  requestPathname: string,
  response: ServerResponse
): Promise<ResponseDescriptor> {
  if (requestPathname === "/healthz") {
    return sendJsonResponse(response, 200, createHealthCheckResponse());
  }

  const resolvedFilePath = resolveFilePathFromRequestPath(requestPathname);

  if (
    !resolvedFilePath ||
    (!resolvedFilePath.startsWith(packagesDirectoryPath) &&
      !resolvedFilePath.startsWith(webSourceDirectoryPath) &&
      !resolvedFilePath.startsWith(webDistDirectoryPath))
  ) {
    return sendTextResponse(response, 404, "Not found.");
  }

  return sendFileResponse(response, resolvedFilePath);
}

const runtimeConfiguration = resolveRuntimeConfiguration();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const requestStartTime = Date.now();
  let responseDescriptor: ResponseDescriptor;

  try {
    responseDescriptor = await handleRequest(requestUrl.pathname, response);
  } catch {
    responseDescriptor = sendTextResponse(response, 500, "Internal server error.");
  }

  // Registramos cada request completada para que un despliegue pequeno tenga trazabilidad operativa basica.
  writeStructuredServerLog({
    kind: "web_request_completed",
    method: request.method ?? "GET",
    path: requestUrl.pathname,
    statusCode: responseDescriptor.statusCode,
    contentType: responseDescriptor.contentType,
    durationMs: Date.now() - requestStartTime
  });
});

function handleServerStarted(): void {
  writeStructuredServerLog({
    kind: "web_server_started",
    bindHost: runtimeConfiguration.host ?? "default",
    port: runtimeConfiguration.port,
    localUrl: `http://localhost:${runtimeConfiguration.port}`,
    healthCheckPath: "/healthz"
  });

  console.log(`Cipher Web is available at http://localhost:${runtimeConfiguration.port}`);
}

if (runtimeConfiguration.host) {
  server.listen(runtimeConfiguration.port, runtimeConfiguration.host, handleServerStarted);
} else {
  server.listen(runtimeConfiguration.port, handleServerStarted);
}
