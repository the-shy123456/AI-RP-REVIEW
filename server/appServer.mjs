import fs from "node:fs";
import { createReadStream } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAiReviewRequest } from "./aiReviewCore.mjs";
import {
  createGitHubAuthCallbackResponse,
  createGitHubAuthLogoutResponse,
  createGitHubAuthStartResponse,
  createGitHubAuthStatusResponse,
} from "./githubAuthCore.mjs";
import { handleGitHubPullRequestRequest } from "./githubPullRequestCore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

loadEnvFiles([".env.production", ".env.local", ".env"]);

const server = http.createServer(async (request, response) => {
  try {
    if (request.url?.startsWith("/api/")) {
      await routeApiRequest(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json;charset=utf-8" });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    );
  }
});

server.listen(port, host, () => {
  console.log(`AI PR Review server listening on http://${host}:${port}`);
});

async function routeApiRequest(request, response) {
  const origin = getRequestOrigin(request);
  const requestUrl = new URL(request.url || "/", origin);

  if (requestUrl.pathname === "/api/ai-review") {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const result = await handleAiReviewRequest(await readJsonBody(request));
    writeJson(response, result.status, result.body);
    return;
  }

  if (requestUrl.pathname === "/api/github-pr") {
    if (!["GET", "POST"].includes(request.method || "")) {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const params =
      request.method === "POST"
        ? await readJsonBody(request)
        : Object.fromEntries(requestUrl.searchParams.entries());
    const result = await handleGitHubPullRequestRequest({
      ...params,
      cookieHeader: request.headers.cookie,
    });
    writeJson(response, result.status, result.body);
    return;
  }

  if (requestUrl.pathname === "/api/github-auth/start") {
    const result = createGitHubAuthStartResponse({
      origin,
      state: requestUrl.searchParams.get("state"),
    });
    writeResponse(response, result);
    return;
  }

  if (requestUrl.pathname === "/api/github-auth/callback") {
    const result = await createGitHubAuthCallbackResponse({
      code: requestUrl.searchParams.get("code"),
      cookieHeader: request.headers.cookie,
      origin,
      state: requestUrl.searchParams.get("state"),
    });
    writeResponse(response, result);
    return;
  }

  if (requestUrl.pathname === "/api/github-auth/logout") {
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const result = createGitHubAuthLogoutResponse({ origin });
    writeJson(response, result.status, result.body, result.headers);
    return;
  }

  if (requestUrl.pathname === "/api/github-auth/status") {
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const result = createGitHubAuthStatusResponse({
      cookieHeader: request.headers.cookie,
    });
    writeJson(response, result.status, result.body);
    return;
  }

  writeJson(response, 404, { error: "Not found" });
}

async function serveStatic(request, response) {
  if (!fs.existsSync(distDir)) {
    response.writeHead(503, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("Production build not found. Run npm run build first.");
    return;
  }

  const requestPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, normalizedPath);

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  response.writeHead(200, {
    "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Type": getContentType(filePath),
  });
  createReadStream(filePath).pipe(response);
}

function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...headers,
    "Content-Type": "application/json;charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function writeResponse(response, result) {
  response.writeHead(result.status, result.headers);
  response.end(result.body || "");
}

async function readJsonBody(request) {
  const body = await readBody(request);

  if (!body.trim()) {
    return {};
  }

  return JSON.parse(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function getRequestOrigin(request) {
  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const protocol = forwardedProto || (request.socket.encrypted ? "https" : "http");
  const hostHeader = forwardedHost || request.headers.host || `127.0.0.1:${port}`;

  return `${protocol}://${hostHeader}`;
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : String(value || "").split(",")[0].trim();
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  const types = {
    ".css": "text/css;charset=utf-8",
    ".html": "text/html;charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript;charset=utf-8",
    ".json": "application/json;charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };

  return types[extension] || "application/octet-stream";
}

function loadEnvFiles(fileNames) {
  fileNames.forEach((fileName) => {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  });
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
