import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  GitPullRequest,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import type { AiCodeReview, MergeRecommendation } from "../lib/aiCodeReview";
import type {
  CategorySummary,
  ReviewFinding,
  ReviewReport,
} from "../lib/reviewEngine";

const severityLabels = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

const categoryLabels = {
  security: "安全",
  testing: "测试",
  reliability: "可靠性",
  maintainability: "可维护性",
  process: "流程",
};

interface ReviewPanelProps {
  activeTab: "findings" | "ai" | "description" | "tests";
  aiReview: AiCodeReview | null;
  aiReviewError: string;
  aiReviewLoading: boolean;
  fullReport: string;
  onAiReview: () => void;
  onTabChange: (tab: ReviewPanelProps["activeTab"]) => void;
  report: ReviewReport;
}

export function ReviewPanel({
  activeTab,
  aiReview,
  aiReviewError,
  aiReviewLoading,
  fullReport,
  onAiReview,
  onTabChange,
  report,
}: ReviewPanelProps) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyGeneratedText(label: string, value: string) {
    try {
      const copied = await copyTextToClipboard(value);
      setCopyStatus(copied ? `${label}已复制` : `${label}复制失败`);
    } catch {
      setCopyStatus(`${label}复制失败`);
    }

    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <section className="review-panel" aria-label="review report">
      <div className="summary-band">
        <Sparkles size={22} />
        <p>{report.summary}</p>
      </div>

      <div className="tabs" role="tablist" aria-label="review sections">
        <button
          className={activeTab === "findings" ? "active" : ""}
          onClick={() => onTabChange("findings")}
        >
          <AlertTriangle size={16} /> 审查意见
        </button>
        <button
          className={activeTab === "ai" ? "active" : ""}
          onClick={() => onTabChange("ai")}
        >
          <Bot size={16} /> AI 代码评审
        </button>
        <button
          className={activeTab === "description" ? "active" : ""}
          onClick={() => onTabChange("description")}
        >
          <GitPullRequest size={16} /> PR 描述
        </button>
        <button
          className={activeTab === "tests" ? "active" : ""}
          onClick={() => onTabChange("tests")}
        >
          <ListChecks size={16} /> 测试与交付
        </button>
      </div>

      {activeTab === "findings" && (
        <div className="findings-list">
          <CategorySummaryBar items={report.categorySummary} />
          {report.findings.length === 0 ? (
            <EmptyState />
          ) : (
            report.findings.map((finding) => (
              <FindingItem key={finding.id} finding={finding} />
            ))
          )}
        </div>
      )}

      {activeTab === "description" && (
        <section className="generated-section">
          <div className="section-toolbar">
            <span>{copyStatus || "可直接粘贴到 PR 描述"}</span>
            <button
              onClick={() => copyGeneratedText("PR 描述", report.prDescription)}
              type="button"
            >
              <Clipboard size={16} /> 复制
            </button>
          </div>
          <pre className="generated-copy">{report.prDescription}</pre>
        </section>
      )}

      {activeTab === "ai" && (
        <AiReviewSection
          error={aiReviewError}
          loading={aiReviewLoading}
          onAiReview={onAiReview}
          review={aiReview}
        />
      )}

      {activeTab === "tests" && (
        <section className="generated-section">
          <div className="section-toolbar">
            <span>{copyStatus || "复制完整报告作为 Review 评论草稿"}</span>
            <button
              onClick={() => copyGeneratedText("完整报告", fullReport)}
              type="button"
            >
              <Clipboard size={16} /> 复制
            </button>
          </div>
          <div className="checklist-grid">
            <Checklist title="测试建议" items={report.testPlan} />
            <Checklist title="交付检查" items={report.deliveryChecklist} />
          </div>
        </section>
      )}
    </section>
  );
}

function AiReviewSection({
  error,
  loading,
  onAiReview,
  review,
}: {
  error: string;
  loading: boolean;
  onAiReview: () => void;
  review: AiCodeReview | null;
}) {
  return (
    <section className="ai-review-section">
      <div className="section-toolbar">
        <span>大模型会阅读 PR diff，评价代码质量并给出合并建议</span>
        <button disabled={loading} onClick={onAiReview} type="button">
          <Bot size={16} /> {loading ? "评审中" : review ? "重新评审" : "开始 AI 评审"}
        </button>
      </div>
      {error && <p className="error-note">{error}</p>}
      {!review && !error && (
        <section className="ai-empty">
          <h3>等待 AI 代码评审</h3>
          <p>
            规则引擎负责快速筛查硬风险；AI 代码评审会进一步判断代码是否周到、整洁、完整，以及是否建议合并。
          </p>
        </section>
      )}
      {review && (
        <div className="ai-review-content">
          <article className={`merge-card merge-${review.mergeRecommendation}`}>
            <span>{mergeLabels[review.mergeRecommendation]}</span>
            <strong>{review.codeQualityScore}/100</strong>
            <p>{review.mergeRecommendationText}</p>
          </article>
          <section className="ai-summary">
            <h3>总体评价</h3>
            <p>{review.summary}</p>
          </section>
          <section className="dimension-grid">
            {review.dimensions.map((dimension) => (
              <article key={dimension.name}>
                <span>{dimension.name}</span>
                <strong>{dimension.score}</strong>
                <p>{dimension.assessment}</p>
              </article>
            ))}
          </section>
          {review.positiveNotes.length > 0 && (
            <section className="ai-summary">
              <h3>做得好的地方</h3>
              {review.positiveNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </section>
          )}
          <section className="ai-findings">
            <h3>AI 发现的问题</h3>
            {review.findings.length === 0 ? (
              <p>AI 未发现必须修改的问题。</p>
            ) : (
              review.findings.map((finding) => (
                <article key={`${finding.title}-${finding.file ?? ""}-${finding.line ?? ""}`}>
                  <div>
                    <strong>{finding.title}</strong>
                    <span>
                      {severityLabels[finding.severity]}
                      {finding.file ? ` · ${finding.file}` : ""}
                      {finding.line ? `:${finding.line}` : ""}
                    </span>
                  </div>
                  <p>{finding.recommendation}</p>
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </section>
  );
}

const mergeLabels: Record<MergeRecommendation, string> = {
  approve: "建议合并",
  comment: "有条件合并",
  request_changes: "建议修改后再合并",
};

function CategorySummaryBar({ items }: { items: CategorySummary[] }) {
  return (
    <section className="category-summary" aria-label="review category summary">
      {items.map((item) => (
        <article key={item.category}>
          <span>{categoryLabels[item.category]}</span>
          <strong>{item.count}</strong>
          <small>
            {item.highestSeverity ? severityLabels[item.highestSeverity] : "无"}
          </small>
        </article>
      ))}
    </section>
  );
}

function FindingItem({ finding }: { finding: ReviewFinding }) {
  return (
    <article className={`finding severity-${finding.severity}`}>
      <div className="finding-title">
        <div>
          <strong>{finding.title}</strong>
          <span>{categoryLabels[finding.category]}</span>
        </div>
        <b>{severityLabels[finding.severity]}</b>
      </div>
      <p>{finding.evidence}</p>
      <p>{finding.recommendation}</p>
    </article>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="checklist">
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>
          <CheckCircle2 size={16} />
          <span>{item}</span>
        </p>
      ))}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <CheckCircle2 size={32} />
      <h3>未发现内置规则风险</h3>
      <p>建议继续进行业务逻辑、架构一致性和产品体验层面的人工复核。</p>
    </section>
  );
}
