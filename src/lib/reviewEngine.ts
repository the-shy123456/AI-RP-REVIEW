export type Severity = "critical" | "high" | "medium" | "low";

export type ReviewCategory =
  | "security"
  | "testing"
  | "reliability"
  | "maintainability"
  | "process";

export type ReviewMode = "balanced" | "security" | "competition";

export interface ReviewFinding {
  id: string;
  severity: Severity;
  category: ReviewCategory;
  title: string;
  evidence: string;
  recommendation: string;
}

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
}

export interface ReviewInput {
  title: string;
  description: string;
  diff: string;
  mode?: ReviewMode;
  sourceUrl?: string;
}

export interface ReviewReport {
  summary: string;
  riskScore: number;
  riskLevel: "低" | "中" | "高" | "严重";
  changedFiles: ChangedFile[];
  categorySummary: CategorySummary[];
  findings: ReviewFinding[];
  mode: ReviewMode;
  prDescription: string;
  testPlan: string[];
  deliveryChecklist: string[];
}

export interface CategorySummary {
  category: ReviewCategory;
  count: number;
  highestSeverity: Severity | null;
}

type Rule = {
  appliesTo?: ReviewMode[];
  id: string;
  severity: Severity;
  category: ReviewCategory;
  title: string;
  test: (input: ReviewInput, files: ChangedFile[]) => string | null;
  recommendation: string;
};

const severityWeights: Record<Severity, number> = {
  critical: 35,
  high: 25,
  medium: 14,
  low: 7,
};

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const reviewModes: Record<
  ReviewMode,
  { description: string; label: string }
> = {
  balanced: {
    label: "均衡审查",
    description: "覆盖安全、测试、可靠性和可维护性，适合日常 PR 自检。",
  },
  security: {
    label: "安全优先",
    description: "突出 token、HTML 注入等安全风险，适合涉及权限或外部输入的变更。",
  },
  competition: {
    label: "参赛规范",
    description: "强化 PR 描述、依赖说明、拆 PR 和交付清单，贴合比赛评审要求。",
  },
};

const rules: Rule[] = [
  {
    appliesTo: ["balanced", "competition"],
    id: "process-empty-diff",
    severity: "high",
    category: "process",
    title: "缺少可审查的 diff 内容",
    test: ({ diff }) =>
      diff.trim().length < 20 ? "当前输入不足以判断实际代码变更。" : null,
    recommendation:
      "粘贴完整 git diff 或 PR patch，确保评审建议能基于真实变更生成。",
  },
  {
    appliesTo: ["balanced", "competition"],
    id: "process-title-format",
    severity: "low",
    category: "process",
    title: "PR 标题建议使用清晰的变更类型前缀",
    test: ({ title }) => {
      const conventionalTitle =
        /^(feat|fix|docs|test|refactor|chore|perf|ci|build)(\(.+\))?: .+/i;
      return title.trim() && !conventionalTitle.test(title.trim())
        ? "标题没有使用 feat/fix/docs/test/refactor 等明确前缀。"
        : null;
    },
    recommendation:
      "用一句话说明变更，例如 feat: add repository import workflow，方便评委快速理解 PR 粒度。",
  },
  {
    id: "security-token-storage",
    severity: "critical",
    category: "security",
    title: "疑似把访问令牌暴露在前端存储或请求体中",
    test: ({ diff }) => {
      const tokenPattern = /(localStorage|sessionStorage).*token|token.*(localStorage|sessionStorage)|access_token/i;
      return tokenPattern.test(diff)
        ? "diff 中出现 localStorage/access_token/token 组合，可能导致凭据泄露。"
        : null;
    },
    recommendation:
      "将第三方平台令牌保存在后端或安全代理层，前端只持有短期会话，不要把 token 回传到业务接口请求体。",
  },
  {
    id: "security-dangerous-html",
    severity: "high",
    category: "security",
    title: "疑似引入未净化的 HTML 注入点",
    test: ({ diff }) =>
      /dangerouslySetInnerHTML|innerHTML\s*=/.test(diff)
        ? "diff 中出现 dangerouslySetInnerHTML 或 innerHTML 赋值。"
        : null,
    recommendation:
      "避免直接注入 HTML；如确有需要，应使用可信白名单净化库，并补充 XSS 回归测试。",
  },
  {
    appliesTo: ["balanced", "competition"],
    id: "testing-deleted-tests",
    severity: "high",
    category: "testing",
    title: "本次变更删除了测试文件",
    test: (_input, files) => {
      const deletedTests = files
        .filter((file) => file.status === "deleted" && isTestFile(file.path))
        .map((file) => file.path);
      return deletedTests.length > 0
        ? `删除的测试文件：${deletedTests.join(", ")}。`
        : null;
    },
    recommendation:
      "补充等价或更高覆盖度的测试，PR 描述中说明删除原因和替代验证方式。",
  },
  {
    appliesTo: ["balanced"],
    id: "reliability-missing-finally",
    severity: "medium",
    category: "reliability",
    title: "异步 loading 状态缺少 finally 兜底",
    test: ({ diff }) => {
      const hasAsync = /async function|await\s/.test(diff);
      const togglesLoading = /setLoading\(true\)|setIsLoading\(true\)/.test(diff);
      const hasFinally = /finally\s*\{/.test(diff);
      return hasAsync && togglesLoading && !hasFinally
        ? "发现 async/await 与 loading 状态切换，但没有 finally 分支。"
        : null;
    },
    recommendation:
      "用 try/catch/finally 或状态机管理异步流程，确保成功和失败路径都会结束 loading 状态。",
  },
  {
    appliesTo: ["balanced"],
    id: "reliability-console-error",
    severity: "low",
    category: "maintainability",
    title: "生产路径中存在 console.error",
    test: ({ diff }) =>
      /console\.(error|log|warn)\(/.test(diff)
        ? "diff 中包含 console 调用。"
        : null,
    recommendation:
      "改用统一日志或用户可感知的错误提示，并避免在生产环境输出敏感上下文。",
  },
  {
    appliesTo: ["balanced", "competition"],
    id: "process-empty-description",
    severity: "high",
    category: "process",
    title: "PR 描述过短，无法支撑评审",
    test: ({ description }) =>
      description.trim().length < 20
        ? "PR 描述少于 20 个字符，评审者难以判断变更意图。"
        : null,
    recommendation:
      "按功能描述、实现思路、测试方式补齐 PR 描述，确保与代码变更一致。",
  },
  {
    appliesTo: ["balanced", "competition"],
    id: "testing-no-test-change",
    severity: "medium",
    category: "testing",
    title: "功能变更没有对应测试变更",
    test: ({ diff }, files) => {
      const changesSource = files.some(
        (file) =>
          !isTestFile(file.path) &&
          !file.path.toLowerCase().includes("readme") &&
          file.status !== "deleted",
      );
      const changesTests = files.some((file) => isTestFile(file.path));
      const hintsFeature = /\b(feat|feature|新增|支持|add|create)\b/i.test(diff);

      return changesSource && hintsFeature && !changesTests
        ? "检测到功能代码变化，但没有测试文件变化。"
        : null;
    },
    recommendation:
      "至少补充单元测试或组件测试；若暂不适合自动化测试，在 PR 描述中写明手动验证步骤。",
  },
  {
    appliesTo: ["balanced", "competition"],
    id: "process-large-pr",
    severity: "medium",
    category: "process",
    title: "PR 规模偏大，建议拆分",
    test: (_input, files) => {
      const churn = files.reduce(
        (total, file) => total + file.additions + file.deletions,
        0,
      );
      return files.length >= 8 || churn >= 400
        ? `当前变更涉及 ${files.length} 个文件、${churn} 行增删。`
        : null;
    },
    recommendation:
      "按照单一功能拆成多个小 PR，分别提交解析、规则、界面、文档或测试变更。",
  },
];

export function analyzePullRequest(input: ReviewInput): ReviewReport {
  const mode = input.mode ?? "balanced";
  const changedFiles = parseChangedFiles(input.diff);
  const findings = rules
    .filter((rule) => !rule.appliesTo || rule.appliesTo.includes(mode))
    .flatMap((rule) => {
      const evidence = rule.test(input, changedFiles);
      if (!evidence) {
        return [];
      }

      return [
        {
          id: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          evidence,
          recommendation: rule.recommendation,
        },
      ];
    })
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity]);

  const riskScore = calculateRiskScore(findings, changedFiles);
  const riskLevel = toRiskLevel(riskScore);

  return {
    summary: buildSummary(input, changedFiles, findings, mode),
    riskScore,
    riskLevel,
    changedFiles,
    categorySummary: buildCategorySummary(findings),
    findings,
    mode,
    prDescription: buildPrDescription(input, findings),
    testPlan: buildTestPlan(changedFiles, findings),
    deliveryChecklist: buildDeliveryChecklist(findings),
  };
}

export function parseChangedFiles(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | null = null;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      if (current) {
        files.push(current);
      }

      const match = line.match(/ b\/(.+)$/);
      current = {
        path: match?.[1] ?? "unknown",
        status: "modified",
        additions: 0,
        deletions: 0,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      current.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
    } else if (line.startsWith("+++ b/")) {
      current.path = line.replace("+++ b/", "").trim();
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
    }
  }

  if (current) {
    files.push(current);
  }

  return files;
}

function calculateRiskScore(findings: ReviewFinding[], files: ChangedFile[]): number {
  const findingScore = findings.reduce(
    (total, finding) => total + severityWeights[finding.severity],
    0,
  );
  const churn = files.reduce(
    (total, file) => total + file.additions + file.deletions,
    0,
  );
  const churnScore = Math.min(20, Math.floor(churn / 20) * 4);

  return Math.min(100, findingScore + churnScore);
}

function toRiskLevel(score: number): ReviewReport["riskLevel"] {
  if (score >= 80) return "严重";
  if (score >= 55) return "高";
  if (score >= 25) return "中";
  return "低";
}

function buildSummary(
  input: ReviewInput,
  files: ChangedFile[],
  findings: ReviewFinding[],
  mode: ReviewMode,
): string {
  const title = input.title.trim() || "未命名 PR";
  const highRiskCount = findings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  ).length;
  const modeLabel = reviewModes[mode].label;

  if (findings.length === 0) {
    return `${modeLabel}模式下，${title} 涉及 ${files.length} 个文件，未命中内置风险规则，可进入常规人工复核。`;
  }

  return `${modeLabel}模式下，${title} 涉及 ${files.length} 个文件，发现 ${findings.length} 个审查点，其中 ${highRiskCount} 个需要优先处理。`;
}

function buildCategorySummary(findings: ReviewFinding[]): CategorySummary[] {
  const categories: ReviewCategory[] = [
    "security",
    "testing",
    "reliability",
    "maintainability",
    "process",
  ];

  return categories.map((category) => {
    const categoryFindings = findings.filter(
      (finding) => finding.category === category,
    );
    const highestSeverity = categoryFindings
      .map((finding) => finding.severity)
      .sort((left, right) => severityRank[right] - severityRank[left])[0];

    return {
      category,
      count: categoryFindings.length,
      highestSeverity: highestSeverity ?? null,
    };
  });
}

function buildPrDescription(input: ReviewInput, findings: ReviewFinding[]): string {
  const feature = input.description.trim() || "请补充本 PR 的业务目标和使用方式。";
  const coreRisks = findings
    .slice(0, 3)
    .map((finding) => `- ${finding.title}：${finding.recommendation}`)
    .join("\n");

  return `## 功能描述
${feature}

## 实现思路
- 基于本次 diff 识别变更文件、风险规则命中项和测试缺口。
- 需要重点关注安全、可靠性、测试覆盖和 PR 过程规范。

## 测试方式
- 运行项目现有自动化测试。
- 覆盖主要成功路径、失败路径和边界输入。
- 针对 Review 建议完成修复后重新提交。

## Review 关注点
${coreRisks || "- 当前没有命中高优先级风险规则，建议继续进行人工业务逻辑复核。"}`;
}

function buildTestPlan(files: ChangedFile[], findings: ReviewFinding[]): string[] {
  const plan = [
    "运行 npm test / 项目既有测试命令，确认自动化测试通过。",
    "按 PR 描述中的使用方式完成一次手动主流程验证。",
  ];

  if (files.some((file) => file.path.endsWith(".tsx") || file.path.endsWith(".jsx"))) {
    plan.push("补充或更新组件交互测试，覆盖加载、成功、失败状态。");
  }

  if (findings.some((finding) => finding.category === "security")) {
    plan.push("检查敏感信息不进入前端存储、日志、URL 或请求体。");
  }

  if (findings.some((finding) => finding.category === "testing")) {
    plan.push("补齐被删除或缺失的测试，并在 PR 描述中列出验证命令。");
  }

  return plan;
}

function buildDeliveryChecklist(findings: ReviewFinding[]): string[] {
  const checklist = [
    "PR 标题用一句话说明新增或修改内容。",
    "PR 描述包含功能描述、实现思路、测试方式。",
    "README 列明第三方依赖和原创功能范围。",
    "合并后主分支保持可运行，可复现 demo 效果。",
  ];

  if (findings.length > 0) {
    checklist.unshift("处理所有 critical/high 级别问题，或在 PR 描述中说明暂缓原因。");
  }

  return checklist;
}

function isTestFile(path: string): boolean {
  return /(\.test\.|\.spec\.|__tests__)/i.test(path);
}
