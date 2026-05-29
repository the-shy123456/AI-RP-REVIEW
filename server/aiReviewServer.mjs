import http from "node:http";
import { handleAiReviewRequest } from "./aiReviewCore.mjs";

const port = Number(process.env.AI_REVIEW_PORT || 8787);

const server = http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/ai-review") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
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
        error: error instanceof Error ? error.message : "AI Review server error",
      }),
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI review API listening on http://127.0.0.1:${port}`);
});

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
