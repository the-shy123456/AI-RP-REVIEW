(function () {
  const rootId = "ai-pr-review-assistant-root";

  const severityWeights = {
    critical: 35,
    high: 25,
    medium: 14,
    low: 7,
  };

  const severityRank = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

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

  const rules = [
    {
      id: "security-token-storage",
      severity: "critical",
      category: "security",
      title: "疑似把访问令牌暴露在前端存储或请求体中",
      test: ({ diff }) =>
        /(localStorage|sessionStorage).*token|token.*(localStorage|sessionStorage)|access_token/i.test(
          diff,
        )
          ? "diff 中出现 localStorage/access_token/token 组合，可能导致凭据泄露。"
          : null,
      recommendation:
        "将第三方平台令牌保存在后端或安全代理层，前端只持有短期会话。",
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
      recommendation: "避免直接注入 HTML；如确有需要，应补充 XSS 回归测试。",
    },
    {
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
      recommendation: "补充等价或更高覆盖度的测试，PR 描述中说明删除原因。",
    },
    {
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
      recommendation: "用 try/catch/finally 管理异步流程，确保失败路径也结束 loading。",
    },
    {
      id: "process-empty-description",
      severity: "high",
      category: "process",
      title: "PR 描述过短，无法支撑评审",
      test: ({ description }) =>
        description.trim().length < 20
          ? "PR 描述少于 20 个字符，评审者难以判断变更意图。"
          : null,
      recommendation: "按功能描述、实现思路、测试方式补齐 PR 描述。",
    },
    {
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
      recommendation: "至少补充单元测试或组件测试；否则写明手动验证步骤。",
    },
    {
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
      recommendation: "按照单一功能拆成多个小 PR，提高审查质量。",
    },
  ];

  function parseCurrentPullRequestUrl() {
    const match = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) {
      throw new Error("当前页面不是 GitHub PR。");
    }

    return {
      owner: match[1],
      repo: match[2],
      pullNumber: Number(match[3]),
      url: `${location.origin}/${match[1]}/${match[2]}/pull/${match[3]}`,
    };
  }

  async function fetchPullRequest(ref) {
    const [metadataResponse, diffResponse] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullNumber}`,
        { headers: { Accept: "application/vnd.github+json" } },
      ),
      fetch(
        `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullNumber}`,
        { headers: { Accept: "application/vnd.github.v3.diff" } },
      ),
    ]);

    if (!metadataResponse.ok || !diffResponse.ok) {
      throw new Error("无法读取该 PR，请确认它公开可访问。");
    }

    const metadata = await metadataResponse.json();
    const diff = await diffResponse.text();

    return {
      description: metadata.body || "",
      diff,
      sourceUrl: metadata.html_url,
      title: metadata.title || `${ref.owner}/${ref.repo}#${ref.pullNumber}`,
    };
  }

  function analyzePullRequest(input) {
    const files = parseChangedFiles(input.diff);
    const findings = rules
      .flatMap((rule) => {
        const evidence = rule.test(input, files);
        return evidence
          ? [
              {
                ...rule,
                evidence,
              },
            ]
          : [];
      })
      .sort((left, right) => severityRank[right.severity] - severityRank[left.severity]);
    const riskScore = calculateRiskScore(findings, files);

    return {
      files,
      findings,
      riskLevel: toRiskLevel(riskScore),
      riskScore,
      summary: `${input.title} 涉及 ${files.length} 个文件，发现 ${findings.length} 个审查点。`,
    };
  }

  function parseChangedFiles(diff) {
    const files = [];
    let current = null;

    for (const line of diff.split(/\r?\n/)) {
      if (line.startsWith("diff --git ")) {
        if (current) {
          files.push(current);
        }

        const match = line.match(/ b\/(.+)$/);
        current = {
          path: match?.[1] || "unknown",
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

  function calculateRiskScore(findings, files) {
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

  function toRiskLevel(score) {
    if (score >= 80) return "严重";
    if (score >= 55) return "高";
    if (score >= 25) return "中";
    return "低";
  }

  function isTestFile(path) {
    return /(\.test\.|\.spec\.|__tests__)/i.test(path);
  }

  function renderShell() {
    const existing = document.getElementById(rootId);
    if (existing) {
      existing.remove();
    }

    const root = document.createElement("aside");
    root.id = rootId;
    root.innerHTML = `
      <header>
        <strong>AI PR Review</strong>
        <button type="button" data-action="analyze">分析当前 PR</button>
      </header>
      <section data-slot="content">
        <p>点击按钮后自动读取当前 GitHub PR 并生成审查结果。</p>
      </section>
    `;
    document.body.appendChild(root);

    root.querySelector("[data-action='analyze']").addEventListener("click", () => {
      void runAnalysis(root);
    });
  }

  async function runAnalysis(root) {
    const content = root.querySelector("[data-slot='content']");
    content.innerHTML = "<p>正在读取 PR...</p>";

    try {
      const input = await fetchPullRequest(parseCurrentPullRequestUrl());
      const report = analyzePullRequest(input);
      content.innerHTML = renderReport(report);
    } catch (error) {
      content.innerHTML = `<p class="ai-pr-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderReport(report) {
    const findings =
      report.findings.length > 0
        ? report.findings
            .slice(0, 8)
            .map(
              (finding) => `
                <article>
                  <div>
                    <strong>${escapeHtml(finding.title)}</strong>
                    <span>${severityLabels[finding.severity]} · ${categoryLabels[finding.category]}</span>
                  </div>
                  <p>${escapeHtml(finding.evidence)}</p>
                  <p>${escapeHtml(finding.recommendation)}</p>
                </article>
              `,
            )
            .join("")
        : "<p>未命中内置风险规则，建议继续人工复核业务逻辑。</p>";

    return `
      <div class="ai-pr-score">
        <b>${report.riskLevel}</b>
        <span>${report.riskScore}/100 · ${report.files.length} files</span>
      </div>
      <p>${escapeHtml(report.summary)}</p>
      <div class="ai-pr-findings">${findings}</div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  renderShell();
})();
