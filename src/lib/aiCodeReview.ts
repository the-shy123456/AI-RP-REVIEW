import type { ReviewInput, ReviewReport } from "./reviewEngine";

export type MergeRecommendation = "approve" | "comment" | "request_changes";

export interface AiReviewDimension {
  assessment: string;
  name: string;
  score: number;
}

export interface AiReviewFinding {
  file?: string;
  line?: number;
  recommendation: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
}

export interface AiCodeReview {
  codeQualityScore: number;
  dimensions: AiReviewDimension[];
  findings: AiReviewFinding[];
  mergeRecommendation: MergeRecommendation;
  mergeRecommendationText: string;
  positiveNotes: string[];
  summary: string;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class AiReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiReviewError";
  }
}

export async function requestAiCodeReview(
  input: ReviewInput,
  ruleReport: ReviewReport,
  llmConfig: LlmConfig,
  fetcher: typeof fetch = fetch,
): Promise<AiCodeReview> {
  const response = await fetcher("/api/ai-review", {
    body: JSON.stringify({ input, llmConfig, ruleReport }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await safeJson(response)) as { error?: string };
    throw new AiReviewError(payload.error ?? `AI 评审失败：${response.status}`);
  }

  return (await response.json()) as AiCodeReview;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
