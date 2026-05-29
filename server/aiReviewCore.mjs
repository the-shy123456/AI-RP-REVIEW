const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MAX_DIFF_CHARS = 90000;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "codeQualityScore",
    "dimensions",
    "findings",
    "positiveNotes",
    "mergeRecommendation",
    "mergeRecommendationText",
  ],
  properties: {
    summary: { type: "string" },
    codeQualityScore: { type: "integer", minimum: 0, maximum: 100 },
    dimensions: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "assessment"],
        properties: {
          name: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          assessment: { type: "string" },
        },
      },
    },
    findings: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "title", "file", "line", "recommendation"],
        properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          title: { type: "string" },
          file: { type: ["string", "null"] },
          line: { type: ["integer", "null"], minimum: 1 },
          recommendation: { type: "string" },
        },
      },
    },
    positiveNotes: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: { type: "string" },
    },
    mergeRecommendation: {
      type: "string",
      enum: ["approve", "comment", "request_changes"],
    },
    mergeRecommendationText: { type: "string" },
  },
};

export async function handleAiReviewRequest(payload, fetcher = fetch) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: "OPENAI_API_KEY 未配置。请在后端环境变量中配置后再使用 AI 代码评审。",
      },
    };
  }

  const input = payload?.input;
  const ruleReport = payload?.ruleReport;

  if (!input?.diff || !input?.title || !ruleReport) {
    return {
      status: 400,
      body: { error: "请求缺少 PR 输入或规则评审结果。" },
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const prompt = buildPrompt(input, ruleReport);
  const response = await fetcher(OPENAI_ENDPOINT, {
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "你是资深代码审查工程师。请基于 PR diff 做严格但务实的代码评审，关注漏洞、边界条件、可维护性、完整性、测试缺口和合并风险。只输出符合 schema 的 JSON。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      reasoning: {
        effort: process.env.OPENAI_REASONING_EFFORT || "medium",
      },
      text: {
        format: {
          type: "json_schema",
          name: "ai_code_review",
          strict: true,
          schema: responseSchema,
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      status: response.status,
      body: {
        error: data?.error?.message || `OpenAI API 请求失败：${response.status}`,
      },
    };
  }

  try {
    return {
      status: 200,
      body: JSON.parse(extractResponseText(data)),
    };
  } catch {
    return {
      status: 502,
      body: { error: "AI 返回结果不是有效 JSON，请稍后重试。" },
    };
  }
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

function extractResponseText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const texts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }

  return texts.join("\n");
}
