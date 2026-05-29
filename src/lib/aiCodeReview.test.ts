import { describe, expect, it, vi } from "vitest";
import { requestAiCodeReview } from "./aiCodeReview";
import { analyzePullRequest } from "./reviewEngine";

const input = {
  title: "feat: add importer",
  description: "新增 PR 导入",
  diff: `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
+export const ok = true;`,
};

describe("requestAiCodeReview", () => {
  it("returns structured AI review result", async () => {
    const aiReview = {
      codeQualityScore: 82,
      dimensions: [{ name: "完整性", score: 80, assessment: "覆盖主流程。" }],
      findings: [],
      mergeRecommendation: "comment",
      mergeRecommendationText: "修复测试缺口后可以合并。",
      positiveNotes: ["结构清晰"],
      summary: "整体质量较好。",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(aiReview), { status: 200 }),
    );

    await expect(
      requestAiCodeReview(input, analyzePullRequest(input), fetcher),
    ).resolves.toMatchObject(aiReview);
  });

  it("surfaces backend error messages", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "OPENAI_API_KEY 未配置" }), {
        status: 503,
      }),
    );

    await expect(
      requestAiCodeReview(input, analyzePullRequest(input), fetcher),
    ).rejects.toThrow("OPENAI_API_KEY 未配置");
  });
});
