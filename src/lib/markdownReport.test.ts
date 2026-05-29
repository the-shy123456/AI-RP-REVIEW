import { describe, expect, it } from "vitest";
import { createMarkdownReport } from "./markdownReport";
import { analyzePullRequest } from "./reviewEngine";

describe("createMarkdownReport", () => {
  it("exports a complete markdown report", () => {
    const input = {
      title: "feat: add html preview",
      description: "新增 HTML 预览能力",
      diff: `diff --git a/src/Preview.tsx b/src/Preview.tsx
--- a/src/Preview.tsx
+++ b/src/Preview.tsx
@@ -1 +1,3 @@
+export function Preview({ html }: { html: string }) {
+  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+}`,
    };
    const report = analyzePullRequest(input);
    const markdown = createMarkdownReport(input, report);

    expect(markdown).toContain("# AI PR Review Report");
    expect(markdown).toContain("feat: add html preview");
    expect(markdown).toContain("src/Preview.tsx");
    expect(markdown).toContain("疑似引入未净化的 HTML 注入点");
    expect(markdown).toContain("## 测试建议");
  });
});
