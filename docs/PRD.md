# AI PR Review Assistant PRD

## Goal

构建一个可演示、可持续迭代的 AI PR Review 助手，帮助参赛项目展示“产品完整度、开发质量、演示表达”三类评分点。MVP 聚焦粘贴 GitHub PR 链接后自动拉取 PR 内容并生成结构化 Review 报告，同时提供 GitHub 页面浏览器插件版本。

## Requirements

- 用户可以输入公开 GitHub PR 链接。
- 系统可以自动拉取 PR 标题、描述和 diff。
- 系统可以解析变更文件、文件状态、增删行数量。
- 系统可以识别安全、测试、可靠性、可维护性和流程规范风险。
- 系统可以生成风险评分、风险等级和审查建议。
- 系统可以生成符合比赛 PR 规范的 PR 描述草稿。
- 系统可以输出测试建议和交付检查清单。
- 用户可以通过浏览器插件在 GitHub PR 页面直接分析当前 PR。

## Acceptance Criteria

- [ ] 打开首页即可看到 GitHub PR URL 导入入口。
- [ ] 输入公开 GitHub PR URL 后可以自动拉取并分析。
- [ ] 浏览器插件可加载到 Chrome/Edge，并在 GitHub PR 页面显示分析按钮。
- [ ] `npm run test` 通过。
- [ ] `npm run build` 通过。
- [ ] README 包含依赖说明、原创范围、运行方式和 demo 链接位置。

## Technical Approach

MVP 采用纯前端实现，避免后端部署成本。GitHub PR 导入逻辑放在 `src/lib/githubPullRequest.ts`，核心 Review 逻辑放在 `src/lib/reviewEngine.ts`，React 层只负责 URL 输入、导入状态、展示和交互。浏览器插件作为 `extension/` 独立目录提供。

## Decision

Context：参赛作品需要快速可演示，同时要能体现架构清晰和测试覆盖。

Decision：使用 Vite + React + TypeScript + Vitest。网页端支持 GitHub PR URL 自动导入；插件端使用 Manifest V3 content script。AI 能力先以规则引擎和结构化生成模拟，后续再接入真实 LLM。

Consequences：MVP 可直接分析公开 GitHub PR，演示路径清晰；不足是 GitHub API rate limit 受匿名访问限制，且暂不支持私有仓库和 Gitee。

## Out of Scope

- 不在 MVP 中接入 GitHub/Gitee OAuth 或私有仓库授权。
- 不在 MVP 中调用真实大模型 API。
- 不在 MVP 中写入仓库评论或自动合并 PR。
- 不伪造历史 commit 或 PR 时间线。

## Technical Notes

- 当前工作区初始为空，不存在 `.trellis` 项目脚本或已有规范。
- 需要创建 PR 模板，帮助后续真实 PR 满足主办方格式要求。
- README 必须明确第三方依赖与原创功能部分。
