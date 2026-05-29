import { describe, expect, it } from "vitest";
import { analyzePullRequest, parseChangedFiles } from "./reviewEngine";

describe("parseChangedFiles", () => {
  it("parses changed files and churn from git diff text", () => {
    const files = parseChangedFiles(`diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
-old
+new
+line
diff --git a/src/b.test.ts b/src/b.test.ts
deleted file mode 100644
--- a/src/b.test.ts
+++ /dev/null
@@ -1 +0,0 @@
-test`);

    expect(files).toEqual([
      { path: "src/a.ts", status: "modified", additions: 2, deletions: 1 },
      { path: "src/b.test.ts", status: "deleted", additions: 0, deletions: 1 },
    ]);
  });
});

describe("analyzePullRequest", () => {
  it("flags security, reliability, and testing risks", () => {
    const report = analyzePullRequest({
      title: "feat: import repository",
      description: "新增仓库导入功能",
      diff: `diff --git a/src/import.ts b/src/import.ts
new file mode 100644
--- /dev/null
+++ b/src/import.ts
@@ -0,0 +1,9 @@
+const token = localStorage.getItem("access_token");
+export async function run() {
+  setLoading(true);
+  await fetch("/api", { method: "POST", body: JSON.stringify({ token }) });
+  console.error("failed");
+  setLoading(false);
+}
diff --git a/src/import.test.ts b/src/import.test.ts
deleted file mode 100644
--- a/src/import.test.ts
+++ /dev/null
@@ -1 +0,0 @@
-it("works", () => {});`,
    });

    expect(report.riskLevel).toMatch(/高|严重/);
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "security-token-storage",
        "testing-deleted-tests",
        "reliability-missing-finally",
      ]),
    );
  });

  it("creates a usable PR description skeleton", () => {
    const report = analyzePullRequest({
      title: "docs: update readme",
      description: "补充 README 使用说明",
      diff: `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Demo
+Usage`,
    });

    expect(report.prDescription).toContain("## 功能描述");
    expect(report.deliveryChecklist).toContain(
      "PR 描述包含功能描述、实现思路、测试方式。",
    );
  });

  it("flags process issues for empty diffs and unclear titles", () => {
    const report = analyzePullRequest({
      title: "update stuff",
      description: "调整了一些内容",
      diff: "",
    });

    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["process-empty-diff", "process-title-format"]),
    );
  });

  it("flags large pull requests", () => {
    const largeDiff = Array.from({ length: 410 }, (_, index) => `+line ${index}`)
      .join("\n");
    const report = analyzePullRequest({
      title: "feat: add many generated files",
      description: "新增大量代码",
      diff: `diff --git a/src/generated.ts b/src/generated.ts
--- a/src/generated.ts
+++ b/src/generated.ts
@@ -0,0 +1,410 @@
${largeDiff}`,
    });

    expect(report.findings.map((finding) => finding.id)).toContain(
      "process-large-pr",
    );
  });
});
