import {
  AlertTriangle,
  ClipboardCheck,
  GitPullRequest,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ReviewReport } from "../lib/reviewEngine";

interface MetricsGridProps {
  report: ReviewReport;
}

export function MetricsGrid({ report }: MetricsGridProps) {
  return (
    <section className="metrics-grid" aria-label="review summary">
      <Metric
        icon={<ShieldAlert size={20} />}
        label="风险等级"
        value={report.riskLevel}
        tone={
          report.riskLevel === "严重"
            ? "danger"
            : report.riskLevel === "高"
              ? "warning"
              : "normal"
        }
      />
      <Metric
        icon={<AlertTriangle size={20} />}
        label="风险分"
        value={`${report.riskScore}/100`}
        tone={report.riskScore >= 55 ? "warning" : "normal"}
      />
      <Metric
        icon={<GitPullRequest size={20} />}
        label="变更文件"
        value={String(report.changedFiles.length)}
      />
      <Metric
        icon={<ClipboardCheck size={20} />}
        label="审查点"
        value={String(report.findings.length)}
        tone={report.findings.length > 0 ? "warning" : "success"}
      />
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "normal",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning" | "danger";
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
