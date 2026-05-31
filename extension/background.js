const MAX_DIFF_CHARS = 90000;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_PROTOCOL = "chat_completions";
const WEB_APP_ORIGIN = "https://chige.9e.nz";
const SYSTEM_PROMPT =
  "你是资深代码审查工程师。请基于 PR diff 做严格但务实的代码评审，关注漏洞、边界条件、可维护性、完整性、测试缺口和合并风险。只输出 JSON，不要输出 Markdown。";
const JSON_OUTPUT_INSTRUCTION =
  "请只返回一个 JSON 对象，字段必须为：summary, codeQualityScore, dimensions, findings, positiveNotes, mergeRecommendation, mergeRecommendationText。mergeRecommendation 只能是 approve、comment 或 request_changes。";

const responseSchema = {
  additionalProperties: false,
  properties: {
    codeQualityScore: {
      maximum: 100,
      minimum: 0,
      type: "integer",
    },
    dimensions: {
      items: {
        additionalProperties: false,
        properties: {
          assessment: { type: "string" },
          name: { type: "string" },
          score: {
            maximum: 100,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["assessment", "name", "score"],
        type: "object",
      },
      type: "array",
    },
    findings: {
      items: {
        additionalProperties: false,
        properties: {
          file: { type: ["string", "null"] },
          line: { type: ["integer", "null"] },
          recommendation: { type: "string" },
          severity: {
            enum: ["critical", "high", "medium", "low"],
            type: "string",
          },
          title: { type: "string" },
        },
        required: ["file", "line", "recommendation", "severity", "title"],
        type: "object",
      },
      type: "array",
    },
    mergeRecommendation: {
      enum: ["approve", "comment", "request_changes"],
      type: "string",
    },
    mergeRecommendationText: { type: "string" },
    positiveNotes: {
      items: { type: "string" },
      type: "array",
    },
    summary: { type: "string" },
  },
  required: [
    "summary",
    "codeQualityScore",
    "dimensions",
    "findings",
    "positiveNotes",
    "mergeRecommendation",
    "mergeRecommendationText",
  ],
  type: "object",
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleRuntimeMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        body: {
          error:
            error instanceof Error
              ? error.message
              : "AI 代码评审失败，请稍后重试。",
        },
        status: 500,
      });
    });

  return true;
});

async function handleRuntimeMessage(message) {
  if (message?.type === "AI_PR_REVIEW_REQUEST") {
    return handleAiReviewRequest(message.payload);
  }

  if (message?.type === "GITHUB_AUTH_STATUS_REQUEST") {
    return fetchLocalJson("/api/github-auth/status");
  }

  if (message?.type === "GITHUB_AUTH_LOGOUT_REQUEST") {
    return fetchLocalJson("/api/github-auth/logout", { method: "POST" });
  }

  if (message?.type === "GITHUB_PR_IMPORT_REQUEST") {
    return importGitHubPullRequest(message.payload);
  }

  return {
    body: { error: "Unsupported extension message." },
    status: 400,
  };
}

async function fetchLocalJson(path, options = {}) {
  try {
    const response = await fetch(`${WEB_APP_ORIGIN}${path}`, {
      credentials: "include",
      ...options,
    });
    const body = await safeReadJson(response);

    return { body, status: response.status };
  } catch {
    return {
      body: {
        error: "本地授权服务不可用，请确认网页端 npm run dev 正在运行。",
      },
      status: 503,
    };
  }
}

async function importGitHubPullRequest(payload) {
  const ref = normalizePullRequestRef(payload);
  if (!ref) {
    return {
      body: { error: "缺少 owner、repo 或 pullNumber。" },
      status: 400,
    };
  }

  const localResult = await fetchLocalJson("/api/github-pr", {
    body: JSON.stringify({
      owner: ref.owner,
      pullNumber: ref.pullNumber,
      repo: ref.repo,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (localResult.status === 200) {
    return localResult;
  }

  if (localResult.status !== 503) {
    return {
      ...localResult,
      body: {
        ...localResult.body,
        authRequired: localResult.status === 403,
      },
    };
  }

  return importPublicGitHubPullRequest(ref);
}

async function importPublicGitHubPullRequest(ref) {
  const [metadataResult, diffResult] = await Promise.all([
    fetchPullRequestMetadata(ref),
    fetchPullRequestDiff(ref),
  ]);

  if (!diffResult.ok) {
    return {
      body: {
        authRequired: diffResult.status === 403,
        error: `无法读取 PR diff，GitHub 返回 ${diffResult.status}。请登录 GitHub 后重试。`,
      },
      status: diffResult.status,
    };
  }

  const metadata = metadataResult.ok ? metadataResult.value : null;

  return {
    body: {
      description: metadata?.body || "",
      diff: diffResult.value,
      mode: "competition",
      sourceUrl: metadata?.html_url || ref.url,
      title: metadata?.title || `${ref.owner}/${ref.repo}#${ref.pullNumber}`,
    },
    status: 200,
  };
}

async function fetchPullRequestMetadata(ref) {
  const response = await safeFetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullNumber}`,
    { headers: { Accept: "application/vnd.github+json" } },
  );

  if (!response?.ok) {
    return { ok: false, status: response?.status || 502 };
  }

  return { ok: true, value: await response.json() };
}

async function fetchPullRequestDiff(ref) {
  const apiDiff = await safeFetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullNumber}`,
    { headers: { Accept: "application/vnd.github.v3.diff" } },
  );

  if (apiDiff?.ok) {
    const diff = await apiDiff.text();
    if (diff.trim()) {
      return { ok: true, value: diff };
    }
  }

  const publicDiff = await safeFetch(`${ref.url}.diff`, {
    credentials: "include",
    headers: { Accept: "text/plain" },
  });

  if (publicDiff?.ok) {
    const diff = await publicDiff.text();
    if (diff.trim()) {
      return { ok: true, value: diff };
    }
  }

  return {
    ok: false,
    status: apiDiff?.status || publicDiff?.status || 502,
  };
}

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    return null;
  }
}

function normalizePullRequestRef(payload) {
  const owner = clean(payload?.owner);
  const repo = clean(payload?.repo);
  const pullNumber = Number(payload?.pullNumber);

  if (!owner || !repo || !Number.isInteger(pullNumber) || pullNumber <= 0) {
    return null;
  }

  return {
    owner,
    repo,
    pullNumber,
    url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
  };
}

async function handleAiReviewRequest(payload) {
  const input = payload?.input;
  const ruleReport = payload?.ruleReport;

  if (!input?.diff || !input?.title || !ruleReport) {
    return {
      status: 400,
      body: { error: "请求缺少 PR 输入或规则评审结果。" },
    };
  }

  const llmConfig = resolveLlmConfig(payload?.llmConfig);
  if (!llmConfig.apiKey) {
    return {
      status: 503,
      body: { error: "请先在插件面板中保存 API_KEY。" },
    };
  }

  if (!llmConfig.model) {
    return {
      status: 400,
      body: { error: "请先在插件面板中保存 MODEL。" },
    };
  }

  const endpoint = buildModelEndpoint(llmConfig);
  const modelResponse = await requestModel(endpoint, {
    body: JSON.stringify(
      buildModelRequestBody(llmConfig, buildPrompt(input, ruleReport)),
    ),
    headers: {
      Authorization: `Bearer ${llmConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!modelResponse.ok) {
    return modelResponse;
  }

  const data = await safeReadJson(modelResponse.value);
  if (!modelResponse.value.ok) {
    return {
      status: modelResponse.value.status,
      body: {
        error: buildModelErrorMessage(data, modelResponse.value.status),
      },
    };
  }

  try {
    return {
      status: 200,
      body: normalizeAiReview(
        parseAiReviewJson(extractModelText(data, llmConfig.protocol)),
      ),
    };
  } catch {
    return {
      status: 502,
      body: { error: "AI 返回结果不是有效 JSON，请检查模型是否支持 JSON 输出。" },
    };
  }
}

async function requestModel(endpoint, options) {
  try {
    return {
      ok: true,
      value: await fetch(endpoint, options),
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      body: {
        error: `无法连接大模型接口：${error instanceof Error ? error.message : "网络请求失败"}`,
      },
    };
  }
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text.slice(0, 400) };
  }
}

function buildModelErrorMessage(data, status) {
  const message =
    data?.error?.message ||
    data?.message ||
    data?.rawText ||
    `HTTP ${status}`;

  return `大模型 API 请求失败：${message}`;
}

function buildModelEndpoint(config) {
  const protocol = normalizeProtocol(config?.protocol);
  const path = protocol === "responses" ? "/responses" : "/chat/completions";
  const normalized = String(config?.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  if (normalized.endsWith(path)) {
    return normalized;
  }

  if (normalized.endsWith("/chat/completions")) {
    return `${normalized.slice(0, -"/chat/completions".length)}${path}`;
  }

  if (normalized.endsWith("/responses")) {
    return `${normalized.slice(0, -"/responses".length)}${path}`;
  }

  return `${normalized}${path}`;
}

function resolveLlmConfig(config) {
  return {
    apiKey: clean(config?.apiKey),
    baseUrl: clean(config?.baseUrl) || DEFAULT_BASE_URL,
    model: clean(config?.model),
    protocol: normalizeProtocol(clean(config?.protocol)),
  };
}

function normalizeProtocol(value) {
  return value === "responses" ? "responses" : DEFAULT_PROTOCOL;
}

function buildPrompt(input, ruleReport) {
  const diff = input.diff.length > MAX_DIFF_CHARS
    ? `${input.diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`
    : input.diff;

  return `请评审这个 Pull Request 的代码质量。

PR 标题：
${input.title}

PR 链接：
${input.sourceUrl || "未提供"}

PR 描述：
${input.description || "未提供"}

规则引擎已发现的问题：
${ruleReport.findings.map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.evidence}`).join("\n") || "无"}

请重点判断：
1. 是否存在安全漏洞、数据泄露、XSS、权限绕过、输入校验不足。
2. 代码是否整洁、职责是否清晰、命名是否清楚、是否有重复或过度复杂。
3. 变更是否考虑完整，包括错误处理、边界条件、加载状态、兼容性。
4. 测试是否足够，是否覆盖失败路径和关键边界。
5. 是否建议合并：approve / comment / request_changes。

PR diff：
\`\`\`diff
${diff}
\`\`\``;
}

function buildModelRequestBody(llmConfig, prompt) {
  const userContent = `${prompt}\n\n${JSON_OUTPUT_INSTRUCTION}`;

  if (llmConfig.protocol === "responses") {
    return {
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      model: llmConfig.model,
      text: {
        format: {
          name: "ai_code_review",
          schema: responseSchema,
          strict: true,
          type: "json_schema",
        },
      },
      temperature: 0.2,
    };
  }

  return {
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    model: llmConfig.model,
    response_format: { type: "json_object" },
    temperature: 0.2,
  };
}

function extractModelText(data, protocol) {
  if (protocol === "responses") {
    return extractResponsesText(data);
  }

  return extractChatCompletionText(data);
}

function extractChatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractResponsesText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  return data.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((part) => part?.text || part?.output_text || part?.content || "")
    .filter(Boolean)
    .join("\n");
}

function parseAiReviewJson(text) {
  const trimmed = String(text || "").trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence);
}

function normalizeAiReview(value) {
  return {
    codeQualityScore: clampScore(value.codeQualityScore),
    dimensions: Array.isArray(value.dimensions)
      ? value.dimensions.map((item) => ({
          assessment: String(item.assessment || ""),
          name: String(item.name || "未命名维度"),
          score: clampScore(item.score),
        }))
      : [],
    findings: Array.isArray(value.findings)
      ? value.findings.map((item) => ({
          file: item.file || null,
          line: Number.isInteger(item.line) ? item.line : null,
          recommendation: String(item.recommendation || ""),
          severity: normalizeSeverity(item.severity),
          title: String(item.title || "未命名问题"),
        }))
      : [],
    mergeRecommendation: normalizeMergeRecommendation(value.mergeRecommendation),
    mergeRecommendationText: String(value.mergeRecommendationText || ""),
    positiveNotes: Array.isArray(value.positiveNotes)
      ? value.positiveNotes.map((item) => String(item))
      : [],
    summary: String(value.summary || ""),
  };
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value) {
  return ["critical", "high", "medium", "low"].includes(value)
    ? value
    : "medium";
}

function normalizeMergeRecommendation(value) {
  return ["approve", "comment", "request_changes"].includes(value)
    ? value
    : "comment";
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
