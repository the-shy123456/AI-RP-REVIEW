const MAX_DIFF_CHARS = 90000;

export async function handleAiReviewRequest(payload, fetcher = fetch) {
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
      body: {
        error: "请在页面大模型配置中填写 API_KEY，或在后端环境变量中配置 OPENAI_API_KEY。",
      },
    };
  }

  if (!llmConfig.model) {
    return {
      status: 400,
      body: {
        error: "请在页面大模型配置中填写 MODEL，或在后端环境变量中配置 OPENAI_MODEL。",
      },
    };
  }

  const prompt = buildPrompt(input, ruleReport);
  const response = await fetcher(buildChatCompletionsUrl(llmConfig.baseUrl), {
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "你是资深代码审查工程师。请基于 PR diff 做严格但务实的代码评审，关注漏洞、边界条件、可维护性、完整性、测试缺口和合并风险。只输出 JSON，不要输出 Markdown。",
        },
        {
          role: "user",
          content: `${prompt}\n\n请只返回一个 JSON 对象，字段必须为：summary, codeQualityScore, dimensions, findings, positiveNotes, mergeRecommendation, mergeRecommendationText。mergeRecommendation 只能是 approve、comment 或 request_changes。`,
        },
      ],
      model: llmConfig.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
    headers: {
      Authorization: `Bearer ${llmConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      status: response.status,
      body: {
        error: data?.error?.message || `大模型 API 请求失败：${response.status}`,
      },
    };
  }

  try {
    return {
      status: 200,
      body: normalizeAiReview(JSON.parse(extractChatCompletionText(data))),
    };
  } catch {
    return {
      status: 502,
      body: { error: "AI 返回结果不是有效 JSON，请检查模型是否支持 JSON 输出。" },
    };
  }
}

export function buildChatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

function resolveLlmConfig(config) {
  return {
    apiKey: clean(config?.apiKey) || clean(process.env.OPENAI_API_KEY),
    baseUrl:
      clean(config?.baseUrl) ||
      clean(process.env.OPENAI_BASE_URL) ||
      "https://api.openai.com/v1",
    model: clean(config?.model) || clean(process.env.OPENAI_MODEL),
  };
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
