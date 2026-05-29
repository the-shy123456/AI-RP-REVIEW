import {
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  ListChecks,
  Sparkles,
} from "lucide-react";
import type { ReviewFinding, ReviewReport } from "../lib/reviewEngine";

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
  activeTab: "findings" | "description" | "tests";
  onTabChange: (tab: ReviewPanelProps["activeTab"]) => void;
  report: ReviewReport;
}

export function ReviewPanel({
  activeTab,
  onTabChange,
  report,
}: ReviewPanelProps) {
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
        <pre className="generated-copy">{report.prDescription}</pre>
      )}

      {activeTab === "tests" && (
        <div className="checklist-grid">
          <Checklist title="测试建议" items={report.testPlan} />
          <Checklist title="交付检查" items={report.deliveryChecklist} />
        </div>
      )}
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
