# Review Rules

MVP 使用可解释的规则引擎生成 Review 建议。每条规则包含：

- `id`：稳定标识，便于测试和后续配置化。
- `severity`：`critical`、`high`、`medium`、`low`。
- `category`：安全、测试、可靠性、可维护性、流程。
- `test`：基于 PR 输入和变更文件的检测函数。
- `recommendation`：面向开发者的修复建议。

## 当前规则

| Rule | Severity | Category | Purpose |
| --- | --- | --- | --- |
| `process-empty-diff` | high | process | 防止缺少真实 diff 的空评审。 |
| `process-title-format` | low | process | 提醒 PR 标题使用清晰类型前缀。 |
| `security-token-storage` | critical | security | 识别前端 token 存储或传输风险。 |
| `security-dangerous-html` | high | security | 识别未净化 HTML 注入点。 |
| `testing-deleted-tests` | high | testing | 识别删除测试文件的高风险变更。 |
| `reliability-missing-finally` | medium | reliability | 识别异步 loading 缺少 finally 的风险。 |
| `reliability-console-error` | low | maintainability | 提醒生产路径中残留 console 调用。 |
| `process-empty-description` | high | process | 防止 PR 描述过短。 |
| `testing-no-test-change` | medium | testing | 提醒功能变更补充测试。 |
| `process-large-pr` | medium | process | 提醒大 PR 拆分。 |

## 扩展方式

在 `src/lib/reviewEngine.ts` 的 `rules` 数组中追加规则，并在 `src/lib/reviewEngine.test.ts` 中补充命中和非命中用例。

建议新增规则时遵循：

- 一条规则只判断一个明确风险。
- 证据文案要说明命中原因。
- 修复建议要可执行。
- 高风险规则必须有测试覆盖。
