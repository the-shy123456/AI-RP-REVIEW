import { describe, expect, it } from "vitest";
import {
  buildChatCompletionsUrl,
  handleAiReviewRequest,
} from "./aiReviewCore.mjs";

describe("buildChatCompletionsUrl", () => {
  it("appends chat completions path to OpenAI-compatible base URLs", () => {
    expect(buildChatCompletionsUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("keeps full chat completions URLs", () => {
    expect(
      buildChatCompletionsUrl("https://api.example.com/v1/chat/completions"),
    ).toBe("https://api.example.com/v1/chat/completions");
  });
});

describe("handleAiReviewRequest", () => {
  it("calls configured third-party model endpoint", async () => {
    const fetcher = async (url, options) => {
      expect(url).toBe("https://api.example.com/v1/chat/completions");
      expect(options.headers.Authorization).toBe("Bearer sk-test");
      const body = JSON.parse(options.body);
      expect(body.model).toBe("third-party-model");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  codeQualityScore: 88,
                  dimensions: [
                    { name: "完整性", score: 86, assessment: "覆盖较完整。" },
                  ],
                  findings: [],
                  mergeRecommendation: "comment",
                  mergeRecommendationText: "补充测试后合并。",
                  positiveNotes: ["结构清晰"],
                  summary: "整体质量较好。",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    await expect(
      handleAiReviewRequest(
        {
          input: {
            title: "feat: demo",
            description: "demo",
            diff: "diff --git a/a b/a",
          },
          llmConfig: {
            apiKey: "sk-test",
            baseUrl: "https://api.example.com/v1",
            model: "third-party-model",
          },
          ruleReport: { findings: [] },
        },
        fetcher,
      ),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        codeQualityScore: 88,
        mergeRecommendation: "comment",
      },
    });
  });
});
