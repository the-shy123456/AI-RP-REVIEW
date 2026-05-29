import type { AiCodeReview } from "./aiCodeReview";
import type { ReviewInput, ReviewReport, Severity } from "./reviewEngine";

const severityLabels: Record<Severity, string> = {
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

export function createMarkdownReport(
  input: ReviewInput,
  report: ReviewReport,
  aiReview?: AiCodeReview | null,
): string {
  const findingLines =
    report.findings.length > 0
      ? report.findings
          .map(
            (finding, index) => `${index + 1}. **[${severityLabels[finding.severity]}] ${finding.title}**
   - 证据：${finding.evidence}
   - 建议：${finding.recommendation}`,
          )
          .join("\n")
      : "未命中内置风险规则，建议继续进行人工业务逻辑复核。";

  const fileLines =
    report.changedFiles.length > 0
      ? report.changedFiles
          .map(
            (file) =>
              `- ${file.path} (${file.status})：+${file.additions} / -${file.deletions}`,
          )
          .join("\n")
      : "- 未解析到变更文件";
  const aiReviewLines = aiReview
    ? `## AI 代码质量评审

- 代码质量分：${aiReview.codeQualityScore}/100
- 合并建议：${mergeRecommendationLabels[aiReview.mergeRecommendation]}
- 建议说明：${aiReview.mergeRecommendationText}

### 总体评价

${aiReview.summary}

### 维度评价

${aiReview.dimensions
  .map((item) => `- ${item.name}：${item.score}/100。${item.assessment}`)
  .join("\n")}

### AI 发现的问题

${
  aiReview.findings.length > 0
    ? aiReview.findings
        .map(
          (finding, index) =>
            `${index + 1}. **[${severityLabels[finding.severity]}] ${finding.title}**${
              finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})` : ""
            }\n   - 建议：${finding.recommendation}`,
        )
        .join("\n")
    : "AI 未发现必须修改的问题。"
}
`
    : "";

  return `# AI PR Review Report

## PR 信息

- 标题：${input.title.trim() || "未填写"}
- PR 链接：${input.sourceUrl ?? "未提供"}
- 审查策略：${report.mode}
- 风险等级：${report.riskLevel}
- 风险分：${report.riskScore}/100

## 摘要

${report.summary}

## 变更文件

${fileLines}

## 审查意见

${findingLines}

${aiReviewLines}

## 建议 PR 描述

${report.prDescription}

## 测试建议

${report.testPlan.map((item) => `- ${item}`).join("\n")}

## 交付检查

${report.deliveryChecklist.map((item) => `- ${item}`).join("\n")}
`;
}

const mergeRecommendationLabels = {
  approve: "建议合并",
  comment: "有条件合并",
  request_changes: "建议修改后再合并",
};
