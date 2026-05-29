import { useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { ChangedFilesPanel } from "./components/ChangedFilesPanel";
import { MetricsGrid } from "./components/MetricsGrid";
import { PullRequestImporter } from "./components/PullRequestImporter";
import { ReviewPanel } from "./components/ReviewPanel";
import {
  requestAiCodeReview,
  type AiCodeReview,
} from "./lib/aiCodeReview";
import {
  importGitHubPullRequest,
  PullRequestImportError,
} from "./lib/githubPullRequest";
import { createMarkdownReport } from "./lib/markdownReport";
import { analyzePullRequest, type ReviewInput } from "./lib/reviewEngine";

type ReviewTab = "findings" | "ai" | "description" | "tests";

export function App() {
  const [prUrl, setPrUrl] = useState("");
  const [pullRequest, setPullRequest] = useState<ReviewInput | null>(null);
  const [aiReview, setAiReview] = useState<AiCodeReview | null>(null);
  const [aiReviewError, setAiReviewError] = useState("");
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>("findings");

  const report = useMemo(
    () => (pullRequest ? analyzePullRequest(pullRequest) : null),
    [pullRequest],
  );

  async function analyzeUrl() {
    setError("");
    setLoading(true);

    try {
      const imported = await importGitHubPullRequest(prUrl);
      setPullRequest(imported);
      setAiReview(null);
      setAiReviewError("");
      setActiveTab("findings");
    } catch (caught) {
      const message =
        caught instanceof PullRequestImportError
          ? caught.message
          : "导入失败，请确认该 GitHub PR 公开可访问。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function clearAnalysis() {
    setPrUrl("");
    setPullRequest(null);
    setAiReview(null);
    setAiReviewError("");
    setError("");
  }

  async function analyzeCodeWithAi() {
    if (!pullRequest || !report) {
      return;
    }

    setAiReviewError("");
    setAiReviewLoading(true);
    setActiveTab("ai");

    try {
      setAiReview(await requestAiCodeReview(pullRequest, report));
    } catch (caught) {
      setAiReviewError(
        caught instanceof Error
          ? caught.message
          : "AI 代码评审失败，请稍后重试。",
      );
    } finally {
      setAiReviewLoading(false);
    }
  }

  function downloadReport() {
    if (!pullRequest || !report) {
      return;
    }

    const markdown = createMarkdownReport(pullRequest, report, aiReview);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(pullRequest.title) || "pr-review-report"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <AppHeader
        canDownload={Boolean(report)}
        onClear={clearAnalysis}
        onDownload={downloadReport}
      />
      {report ? (
        <MetricsGrid report={report} />
      ) : (
        <section className="empty-analysis">
          <strong>等待 GitHub PR 链接</strong>
          <p>输入公开 PR 地址后，系统会自动拉取 PR 元数据和 diff 并开始审查。</p>
        </section>
      )}
      <section className="workbench">
        <PullRequestImporter
          error={error}
          loading={loading}
          onAnalyze={analyzeUrl}
          onUrlChange={setPrUrl}
          sourceUrl={pullRequest?.sourceUrl}
          title={pullRequest?.title}
          url={prUrl}
        />
        {report && pullRequest ? (
          <ReviewPanel
            activeTab={activeTab}
            aiReview={aiReview}
            aiReviewError={aiReviewError}
            aiReviewLoading={aiReviewLoading}
            fullReport={createMarkdownReport(pullRequest, report, aiReview)}
            onAiReview={analyzeCodeWithAi}
            onTabChange={setActiveTab}
            report={report}
          />
        ) : (
          <section className="review-panel placeholder-panel">
            <h2>PR 分析结果</h2>
            <p>这里会显示风险评分、审查意见、生成的 PR 描述和测试建议。</p>
          </section>
        )}
        <ChangedFilesPanel files={report?.changedFiles ?? []} />
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
