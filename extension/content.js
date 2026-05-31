(function () {
  const rootId = "ai-pr-review-assistant-root";
  const configStorageKey = "ai-pr-review.extension.llm-config";
  const webAppOrigin = "https://chige.9e.nz";
  const defaultLlmConfig = {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    protocol: "chat_completions",
  };

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

  const mergeLabels = {
    approve: "建议合并",
    comment: "有条件合并",
    request_changes: "建议修改后再合并",
  };

  const state = {
    activeTab: "rules",
    aiError: "",
    aiLoading: false,
    aiReview: null,
    configDirty: false,
    configDraft: { ...defaultLlmConfig },
    configSaved: false,
    error: "",
    githubAuthorized: false,
    githubLoginPolling: false,
    githubStatusLoading: true,
    input: null,
    loading: false,
    report: null,
    savedConfig: { ...defaultLlmConfig },
  };
  let saveFeedbackTimer = 0;

  const rules = [
    {
      id: "process-empty-diff",
      severity: "high",
      category: "process",
      title: "缺少可审查的 diff 内容",
      test: ({ diff }) =>
        diff.trim().length < 20 ? "当前输入不足以判断实际代码变更。" : null,
      recommendation: "确保当前 PR 可以读取完整 diff 后再发起评审。",
    },
    {
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
      recommendation: "用一句话说明变更类型和范围，方便快速判断 PR 粒度。",
    },
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
      id: "reliability-console-error",
      severity: "low",
      category: "maintainability",
      title: "生产路径中存在 console 调用",
      test: ({ diff }) =>
        /console\.(error|log|warn)\(/.test(diff)
          ? "diff 中包含 console 调用。"
          : null,
      recommendation: "改用统一日志或用户可感知的错误提示，避免生产环境输出敏感上下文。",
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

  async function init() {
    state.savedConfig = await loadLlmConfig();
    state.configDraft = { ...state.savedConfig };
    await syncGitHubAuthStatus();
    renderShell();
  }

  function renderShell() {
    const existing = document.getElementById(rootId);
    if (existing) {
      existing.remove();
    }

    const root = document.createElement("aside");
    root.id = rootId;
    root.innerHTML = renderPanel();
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    document.body.appendChild(root);
  }

  function renderPanel() {
    return `
      <header>
        <div>
          <strong>AI PR Review</strong>
          <span>GitHub PR 页面助手</span>
        </div>
        <button type="button" data-action="analyze" ${state.loading ? "disabled" : ""}>
          ${state.loading ? "读取中" : state.report ? "重新分析" : "分析当前 PR"}
        </button>
      </header>
      <section class="ai-pr-body">
        ${renderGitHubAuthPanel()}
        ${renderConfigPanel()}
        ${renderMainContent()}
      </section>
    `;
  }

  function renderGitHubAuthPanel() {
    const status = state.githubStatusLoading
      ? "检查授权中"
      : state.githubAuthorized
        ? "GitHub 已授权"
        : state.githubLoginPolling
          ? "等待 GitHub 授权完成"
          : "GitHub 未授权";
    const action = state.githubAuthorized ? "logout-github" : "login-github";
    const label = state.githubAuthorized ? "退出" : "登录 GitHub";

    return `
      <section class="ai-pr-github-auth">
        <div>
          <strong>${status}</strong>
          <span>${state.githubLoginPolling ? "完成授权后回到本页，插件会自动刷新状态。" : "用于通过本地 OAuth 代理读取 PR，避免匿名 403。"}</span>
        </div>
        <button type="button" data-action="${action}" ${state.githubStatusLoading ? "disabled" : ""}>
          ${label}
        </button>
      </section>
    `;
  }

  function renderConfigPanel() {
    return `
      <section class="ai-pr-config">
        <div class="ai-pr-section-title">
          <strong>大模型配置</strong>
          <span data-config-status>${renderConfigStatus()}</span>
        </div>
        <div class="ai-pr-protocol" role="group" aria-label="选择模型协议">
          ${renderProtocolButton("chat_completions", "Chat Completions")}
          ${renderProtocolButton("responses", "OpenAI Responses")}
        </div>
        <label>
          BASE_URL
          <input data-config-field="baseUrl" value="${escapeAttr(state.configDraft.baseUrl)}" placeholder="https://api.openai.com/v1" />
        </label>
        <label>
          API_KEY
          <input data-config-field="apiKey" type="password" value="${escapeAttr(state.configDraft.apiKey)}" placeholder="sk-..." />
        </label>
        <label>
          MODEL
          <input data-config-field="model" value="${escapeAttr(state.configDraft.model)}" placeholder="gpt-4o-mini / qwen-plus / deepseek-chat" />
        </label>
        <button class="ai-pr-secondary" type="button" data-action="save-config" ${state.configDirty ? "" : "disabled"}>
          保存配置
        </button>
      </section>
    `;
  }

  function renderProtocolButton(value, label) {
    const active = state.configDraft.protocol === value;
    return `
      <button
        class="${active ? "active" : ""}"
        type="button"
        data-protocol="${value}"
        aria-pressed="${active ? "true" : "false"}"
      >
        ${label}
      </button>
    `;
  }

  function renderConfigStatus() {
    if (state.configSaved) {
      return "配置已保存";
    }

    return state.configDirty ? "有未保存修改" : "配置已是最新";
  }

  function renderMainContent() {
    if (state.error) {
      return `
        <section class="ai-pr-callout ai-pr-callout-error">
          <p>${escapeHtml(state.error)}</p>
          <button type="button" data-action="analyze">重试读取 PR</button>
        </section>
      `;
    }

    if (!state.report) {
      return `
        <section class="ai-pr-empty">
          <strong>等待分析当前 PR</strong>
          <p>点击“分析当前 PR”后，插件会读取 GitHub metadata 和 diff，生成规则审查结果，并可继续发起 AI 代码评审。</p>
        </section>
      `;
    }

    return `
      <section class="ai-pr-score">
        <b>${state.report.riskLevel}</b>
        <span>${state.report.riskScore}/100 · ${state.report.changedFiles.length} files · ${state.report.findings.length} findings</span>
      </section>
      <p class="ai-pr-summary">${escapeHtml(state.report.summary)}</p>
      <div class="ai-pr-tabs" role="tablist" aria-label="review sections">
        <button type="button" data-tab="rules" class="${state.activeTab === "rules" ? "active" : ""}">规则审查</button>
        <button type="button" data-tab="ai" class="${state.activeTab === "ai" ? "active" : ""}">AI 代码评审</button>
      </div>
      ${state.activeTab === "ai" ? renderAiReviewPanel() : renderRulesPanel()}
    `;
  }

  function renderRulesPanel() {
    const categorySummary = state.report.categorySummary
      .map(
        (item) => `
          <article>
            <span>${categoryLabels[item.category]}</span>
            <strong>${item.count}</strong>
            <small>${item.highestSeverity ? severityLabels[item.highestSeverity] : "无"}</small>
          </article>
        `,
      )
      .join("");
    const findings =
      state.report.findings.length > 0
        ? state.report.findings
            .slice(0, 10)
            .map(
              (finding) => `
                <article class="ai-pr-finding severity-${finding.severity}">
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
        : "<p class=\"ai-pr-muted\">未命中内置风险规则，建议继续人工复核业务逻辑。</p>";

    return `
      <section class="ai-pr-category-grid">${categorySummary}</section>
      <section class="ai-pr-findings">${findings}</section>
    `;
  }

  function renderAiReviewPanel() {
    const actionLabel = state.aiLoading
      ? "评审中"
      : state.aiReview
        ? "重新评审"
        : "开始 AI 评审";
    const error = state.aiError
      ? `
        <section class="ai-pr-callout ai-pr-callout-error">
          <p>${escapeHtml(state.aiError)}</p>
          <button type="button" data-action="run-ai" ${state.aiLoading ? "disabled" : ""}>重试</button>
        </section>
      `
      : "";

    return `
      <section class="ai-pr-ai-toolbar">
        <span>大模型会阅读当前 PR diff，评价代码质量、漏洞风险、完整性和合并建议。</span>
        <button type="button" data-action="run-ai" ${state.aiLoading ? "disabled" : ""}>
          ${actionLabel}
        </button>
      </section>
      ${error}
      ${state.aiReview ? renderAiReviewResult(state.aiReview) : renderAiEmptyState()}
    `;
  }

  function renderAiEmptyState() {
    if (state.aiError) {
      return "";
    }

    return `
      <section class="ai-pr-empty">
        <strong>等待 AI 代码评审</strong>
        <p>先保存大模型配置，再点击“开始 AI 评审”。失败后可直接在这里重试。</p>
      </section>
    `;
  }

  function renderAiReviewResult(review) {
    const dimensions = review.dimensions
      .map(
        (dimension) => `
          <article>
            <span>${escapeHtml(dimension.name)}</span>
            <strong>${dimension.score}</strong>
            <p>${escapeHtml(dimension.assessment)}</p>
          </article>
        `,
      )
      .join("");
    const positiveNotes = review.positiveNotes.length
      ? `
        <section class="ai-pr-ai-block">
          <h4>做得好的地方</h4>
          ${review.positiveNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
        </section>
      `
      : "";
    const findings = review.findings.length
      ? review.findings
          .map(
            (finding) => `
              <article>
                <div>
                  <strong>${escapeHtml(finding.title)}</strong>
                  <span>
                    ${severityLabels[finding.severity]}
                    ${finding.file ? ` · ${escapeHtml(finding.file)}` : ""}
                    ${finding.line ? `:${finding.line}` : ""}
                  </span>
                </div>
                <p>${escapeHtml(finding.recommendation)}</p>
              </article>
            `,
          )
          .join("")
      : "<p class=\"ai-pr-muted\">AI 未发现必须修改的问题。</p>";

    return `
      <section class="ai-pr-merge merge-${review.mergeRecommendation}">
        <span>${mergeLabels[review.mergeRecommendation]}</span>
        <strong>${review.codeQualityScore}/100</strong>
        <p>${escapeHtml(review.mergeRecommendationText)}</p>
      </section>
      <section class="ai-pr-ai-block">
        <h4>总体评价</h4>
        <p>${escapeHtml(review.summary)}</p>
      </section>
      <section class="ai-pr-dimensions">${dimensions}</section>
      ${positiveNotes}
      <section class="ai-pr-ai-findings">
        <h4>AI 发现的问题</h4>
        ${findings}
      </section>
    `;
  }

  async function handleClick(event) {
    const protocolButton = event.target.closest("[data-protocol]");
    if (protocolButton) {
      state.configDraft.protocol = protocolButton.dataset.protocol;
      state.configDirty = true;
      state.configSaved = false;
      renderShell();
      return;
    }

    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      state.activeTab = tabButton.dataset.tab;
      renderShell();
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    if (action === "analyze") {
      await runAnalysis();
    } else if (action === "login-github") {
      loginWithGitHub();
    } else if (action === "logout-github") {
      await logoutGitHub();
    } else if (action === "save-config") {
      await saveCurrentConfig();
    } else if (action === "run-ai") {
      await runAiReview();
    }
  }

  function handleInput(event) {
    const field = event.target.dataset.configField;
    if (!field) {
      return;
    }

    state.configDraft[field] = event.target.value;
    state.configDirty = true;
    state.configSaved = false;
    updateConfigControls();
  }

  function updateConfigControls() {
    const root = document.getElementById(rootId);
    if (!root) {
      return;
    }

    const status = root.querySelector("[data-config-status]");
    const saveButton = root.querySelector("[data-action='save-config']");

    if (status) {
      status.textContent = renderConfigStatus();
    }

    if (saveButton) {
      saveButton.disabled = !state.configDirty;
    }
  }

  async function saveCurrentConfig() {
    state.savedConfig = normalizeLlmConfig(state.configDraft);
    state.configDraft = { ...state.savedConfig };
    state.configDirty = false;
    state.configSaved = true;
    await saveLlmConfig(state.savedConfig);
    renderShell();
    clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = setTimeout(() => {
      state.configSaved = false;
      updateConfigControls();
    }, 1800);
  }

  async function runAnalysis() {
    state.loading = true;
    state.error = "";
    state.aiError = "";
    state.aiReview = null;
    renderShell();

    try {
      const input = await importPullRequest(parseCurrentPullRequestUrl());
      state.input = input;
      state.report = analyzePullRequest(input);
      state.activeTab = "rules";
    } catch (error) {
      state.error =
        error instanceof Error ? error.message : "读取当前 PR 失败，请重试。";
    } finally {
      state.loading = false;
      renderShell();
    }
  }

  async function runAiReview() {
    if (!state.input || !state.report) {
      state.aiError = "请先分析当前 PR。";
      state.activeTab = "ai";
      renderShell();
      return;
    }

    if (state.configDirty) {
      state.aiError = "大模型配置有未保存修改，请先保存配置后再重试。";
      state.activeTab = "ai";
      renderShell();
      return;
    }

    if (!state.savedConfig.apiKey || !state.savedConfig.model) {
      state.aiError = "请先保存 API_KEY 和 MODEL 后再发起 AI 代码评审。";
      state.activeTab = "ai";
      renderShell();
      return;
    }

    state.aiLoading = true;
    state.aiError = "";
    state.activeTab = "ai";
    renderShell();

    try {
      const result = await sendExtensionMessage({
        payload: {
          input: state.input,
          llmConfig: state.savedConfig,
          ruleReport: state.report,
        },
        type: "AI_PR_REVIEW_REQUEST",
      });

      if (!result || result.status !== 200) {
        throw new Error(result?.body?.error || "AI 代码评审失败，请稍后重试。");
      }

      state.aiReview = result.body;
    } catch (error) {
      state.aiError =
        error instanceof Error ? error.message : "AI 代码评审失败，请稍后重试。";
    } finally {
      state.aiLoading = false;
      renderShell();
    }
  }

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

  async function importPullRequest(ref) {
    const result = await sendExtensionMessage({
      payload: ref,
      type: "GITHUB_PR_IMPORT_REQUEST",
    });

    if (!result || result.status !== 200) {
      throw new Error(
        result?.body?.error ||
          "无法读取当前 PR，请登录 GitHub 或稍后重试。",
      );
    }

    return result.body;
  }

  function analyzePullRequest(input) {
    const changedFiles = parseChangedFiles(input.diff);
    const findings = rules
      .flatMap((rule) => {
        const evidence = rule.test(input, changedFiles);
        return evidence
          ? [
              {
                category: rule.category,
                evidence,
                id: rule.id,
                recommendation: rule.recommendation,
                severity: rule.severity,
                title: rule.title,
              },
            ]
          : [];
      })
      .sort((left, right) => severityRank[right.severity] - severityRank[left.severity]);
    const riskScore = calculateRiskScore(findings, changedFiles);

    return {
      categorySummary: buildCategorySummary(findings),
      changedFiles,
      findings,
      riskLevel: toRiskLevel(riskScore),
      riskScore,
      summary: `${input.title} 涉及 ${changedFiles.length} 个文件，发现 ${findings.length} 个审查点。`,
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
          additions: 0,
          deletions: 0,
          path: match?.[1] || "unknown",
          status: "modified",
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

  function buildCategorySummary(findings) {
    return ["security", "testing", "reliability", "maintainability", "process"].map(
      (category) => {
        const categoryFindings = findings.filter(
          (finding) => finding.category === category,
        );
        const highestSeverity = categoryFindings
          .map((finding) => finding.severity)
          .sort((left, right) => severityRank[right] - severityRank[left])[0];

        return {
          category,
          count: categoryFindings.length,
          highestSeverity: highestSeverity || null,
        };
      },
    );
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

  async function loadLlmConfig() {
    const saved = await readStorageValue(configStorageKey);
    return normalizeLlmConfig(saved || defaultLlmConfig);
  }

  async function saveLlmConfig(config) {
    await writeStorageValue(configStorageKey, normalizeLlmConfig(config));
  }

  function normalizeLlmConfig(config) {
    return {
      apiKey: clean(config?.apiKey),
      baseUrl: clean(config?.baseUrl) || defaultLlmConfig.baseUrl,
      model: clean(config?.model),
      protocol:
        config?.protocol === "responses" ? "responses" : "chat_completions",
    };
  }

  function readStorageValue(key) {
    const storage = globalThis.chrome?.storage?.local;
    if (storage) {
      return new Promise((resolve) => {
        storage.get([key], (items) => resolve(items?.[key] || null));
      });
    }

    try {
      const raw = localStorage.getItem(key);
      return Promise.resolve(raw ? JSON.parse(raw) : null);
    } catch {
      return Promise.resolve(null);
    }
  }

  function writeStorageValue(key, value) {
    const storage = globalThis.chrome?.storage?.local;
    if (storage) {
      return new Promise((resolve) => {
        storage.set({ [key]: value }, resolve);
      });
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures; the in-memory config remains usable.
    }
    return Promise.resolve();
  }

  async function syncGitHubAuthStatus() {
    state.githubStatusLoading = true;

    try {
      const result = await sendExtensionMessage({
        type: "GITHUB_AUTH_STATUS_REQUEST",
      });
      state.githubAuthorized = Boolean(result?.body?.authorized);
    } catch {
      state.githubAuthorized = false;
    } finally {
      state.githubStatusLoading = false;
    }
  }

  function loginWithGitHub() {
    state.githubLoginPolling = true;
    renderShell();
    globalThis.open(
      `${webAppOrigin}/api/github-auth/start?state=${encodeURIComponent(
        buildExtensionAuthState(),
      )}`,
      "_blank",
    );
    pollGitHubAuthStatus();
  }

  async function logoutGitHub() {
    state.githubStatusLoading = true;
    renderShell();

    await sendExtensionMessage({ type: "GITHUB_AUTH_LOGOUT_REQUEST" }).catch(
      () => undefined,
    );
    await syncGitHubAuthStatus();
    renderShell();
  }

  function buildExtensionAuthState() {
    return `extension-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function pollGitHubAuthStatus() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await delay(2000);
      await syncGitHubAuthStatus();

      if (state.githubAuthorized) {
        state.githubLoginPolling = false;
        renderShell();
        return;
      }
    }

    state.githubLoginPolling = false;
    renderShell();
  }

  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function sendExtensionMessage(message) {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      return Promise.reject(new Error("扩展后台服务不可用，请重新加载插件。"));
    }

    return new Promise((resolve, reject) => {
      runtime.sendMessage(message, (response) => {
        const lastError = runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  void init();
})();
