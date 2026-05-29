export const samplePullRequest = {
  title: "feat: add repository import workflow",
  description:
    "新增 GitHub/Gitee 仓库链接导入入口，支持填写 PR 标题、描述和 diff 后生成结构化 Review 报告。",
  diff: `diff --git a/src/api/importRepo.ts b/src/api/importRepo.ts
new file mode 100644
index 0000000..2c86ad1
--- /dev/null
+++ b/src/api/importRepo.ts
@@ -0,0 +1,45 @@
+import axios from "axios";
+
+const token = localStorage.getItem("access_token");
+
+export async function importRepository(url: string) {
+  const response = await axios.post("/api/repositories/import", {
+    url,
+    token,
+  });
+
+  return response.data;
+}
diff --git a/src/components/ImportPanel.tsx b/src/components/ImportPanel.tsx
index 7bc861f..fe41099 100644
--- a/src/components/ImportPanel.tsx
+++ b/src/components/ImportPanel.tsx
@@ -1,8 +1,32 @@
 import { useState } from "react";
 import { importRepository } from "../api/importRepo";
 
 export function ImportPanel() {
   const [url, setUrl] = useState("");
+  const [error, setError] = useState("");
+  const [loading, setLoading] = useState(false);
 
-  return <input value={url} onChange={(event) => setUrl(event.target.value)} />;
+  async function handleImport() {
+    setLoading(true);
+    try {
+      await importRepository(url);
+    } catch (err) {
+      console.error(err);
+      setError("导入失败");
+    }
+    setLoading(false);
+  }
+
+  return (
+    <section>
+      <input value={url} onChange={(event) => setUrl(event.target.value)} />
+      <button onClick={handleImport} disabled={loading}>
+        {loading ? "导入中" : "导入"}
+      </button>
+      {error && <p>{error}</p>}
+    </section>
+  );
 }
diff --git a/src/__tests__/ImportPanel.test.tsx b/src/__tests__/ImportPanel.test.tsx
deleted file mode 100644
index 562e4c6..0000000
--- a/src/__tests__/ImportPanel.test.tsx
+++ /dev/null
@@ -1,12 +0,0 @@
-import { render } from "@testing-library/react";
-import { ImportPanel } from "../components/ImportPanel";
-
-it("renders import input", () => {
-  render(<ImportPanel />);
-});`,
};
