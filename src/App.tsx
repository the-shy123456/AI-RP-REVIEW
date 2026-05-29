import { useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { ChangedFilesPanel } from "./components/ChangedFilesPanel";
import { MetricsGrid } from "./components/MetricsGrid";
import { PullRequestEditor } from "./components/PullRequestEditor";
import { ReviewPanel } from "./components/ReviewPanel";
import { samplePullRequest } from "./data/samplePullRequest";
import { createMarkdownReport } from "./lib/markdownReport";
import { analyzePullRequest } from "./lib/reviewEngine";

export function App() {
  const [title, setTitle] = useState(samplePullRequest.title);
  const [description, setDescription] = useState(samplePullRequest.description);
  const [diff, setDiff] = useState(samplePullRequest.diff);
  const [activeTab, setActiveTab] = useState<"findings" | "description" | "tests">(
    "findings",
  );

  const report = useMemo(
    () => analyzePullRequest({ title, description, diff }),
    [title, description, diff],
  );

  function loadSample() {
    setTitle(samplePullRequest.title);
    setDescription(samplePullRequest.description);
    setDiff(samplePullRequest.diff);
  }

  function clearInput() {
    setTitle("");
    setDescription("");
    setDiff("");
  }

  function downloadReport() {
    const markdown = createMarkdownReport({ title, description, diff }, report);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(title) || "pr-review-report"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <AppHeader
        onClear={clearInput}
        onDownload={downloadReport}
        onLoadSample={loadSample}
      />
      <MetricsGrid report={report} />
      <section className="workbench">
        <PullRequestEditor
          description={description}
          diff={diff}
          onDescriptionChange={setDescription}
          onDiffChange={setDiff}
          onTitleChange={setTitle}
          title={title}
        />
        <ReviewPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          report={report}
        />
        <ChangedFilesPanel files={report.changedFiles} />
      </section>
    </main>
  );
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
