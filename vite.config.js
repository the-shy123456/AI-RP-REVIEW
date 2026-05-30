import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleAiReviewRequest } from "./server/aiReviewCore.mjs";
import {
  createGitHubAuthCallbackResponse,
  createGitHubAuthLogoutResponse,
  createGitHubAuthStartResponse,
  createGitHubAuthStatusResponse,
} from "./server/githubAuthCore.mjs";
import { handleGitHubPullRequestRequest } from "./server/githubPullRequestCore.mjs";

export default defineConfig(({ mode }) => {
  loadServerEnv(mode);

  return {
    base: "./",
    plugins: [react(), localApiPlugin()],
  };
});

function loadServerEnv(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const serverEnvKeys = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_TOKEN",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_MODEL",
    "OPENAI_PROTOCOL",
  ];

  serverEnvKeys.forEach((key) => {
    if (!process.env[key] && env[key]) {
      process.env[key] = env[key];
    }
  });
}

function localApiPlugin() {
  return {
    configureServer(server) {
      server.middlewares.use("/api/ai-review", async (request, response) => {
        if (request.method !== "POST") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const payload = JSON.parse(await readBody(request));
          const result = await handleAiReviewRequest(payload);
          response.writeHead(result.status, { "Content-Type": "application/json" });
          response.end(JSON.stringify(result.body));
        } catch (error) {
          response.writeHead(500, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "AI Review server error",
            }),
          );
        }
      });

      server.middlewares.use("/api/github-pr", async (request, response) => {
        if (!["GET", "POST"].includes(request.method || "")) {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const requestParams =
            request.method === "POST"
              ? JSON.parse(await readBody(request))
              : readQueryParams(request.url || "");
          const result = await handleGitHubPullRequestRequest({
            cookieHeader: request.headers.cookie,
            githubToken: requestParams.githubToken,
            owner: requestParams.owner,
            pullNumber: requestParams.pullNumber,
            repo: requestParams.repo,
          });
          response.writeHead(result.status, { "Content-Type": "application/json" });
          response.end(JSON.stringify(result.body));
        } catch (error) {
          response.writeHead(500, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "GitHub PR import server error",
            }),
          );
        }
      });

      server.middlewares.use("/api/github-auth/start", (request, response) => {
        const origin = getRequestOrigin(request);
        const requestUrl = new URL(request.url || "", origin);
        const result = createGitHubAuthStartResponse({
          origin,
          state: requestUrl.searchParams.get("state"),
        });
        response.writeHead(result.status, result.headers);
        response.end(result.body || "");
      });

      server.middlewares.use("/api/github-auth/callback", async (request, response) => {
        const origin = getRequestOrigin(request);
        const requestUrl = new URL(request.url || "", origin);
        const result = await createGitHubAuthCallbackResponse({
          code: requestUrl.searchParams.get("code"),
          cookieHeader: request.headers.cookie,
          origin,
          state: requestUrl.searchParams.get("state"),
        });
        response.writeHead(result.status, result.headers);
        response.end(result.body || "");
      });

      server.middlewares.use("/api/github-auth/logout", (request, response) => {
        if (request.method !== "POST") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const result = createGitHubAuthLogoutResponse({
          origin: getRequestOrigin(request),
        });
        response.writeHead(result.status, {
          ...result.headers,
          "Content-Type": "application/json",
        });
        response.end(JSON.stringify(result.body));
      });

      server.middlewares.use("/api/github-auth/status", (request, response) => {
        if (request.method !== "GET") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const result = createGitHubAuthStatusResponse({
          cookieHeader: request.headers.cookie,
        });
        response.writeHead(result.status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result.body));
      });
    },
    name: "local-api",
  };
}

function getRequestOrigin(request) {
  const protocol = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers.host || "127.0.0.1:5173";

  return `${protocol}://${host}`;
}

function readQueryParams(url) {
  const requestUrl = new URL(url, "http://127.0.0.1");

  return {
    owner: requestUrl.searchParams.get("owner"),
    pullNumber: requestUrl.searchParams.get("pullNumber"),
    repo: requestUrl.searchParams.get("repo"),
  };
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
