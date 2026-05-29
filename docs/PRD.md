# AI PR Review Assistant PRD

## Goal

构建一个可演示、可持续迭代的 AI PR Review 助手，帮助参赛项目展示“产品完整度、开发质量、演示表达”三类评分点。MVP 聚焦本地输入 PR 信息并生成结构化 Review 报告。

## Requirements

- 用户可以输入 PR 标题、描述和 git diff。
- 系统可以解析变更文件、文件状态、增删行数量。
- 系统可以识别安全、测试、可靠性、可维护性和流程规范风险。
- 系统可以生成风险评分、风险等级和审查建议。
- 系统可以生成符合比赛 PR 规范的 PR 描述草稿。
- 系统可以输出测试建议和交付检查清单。

## Acceptance Criteria

- [ ] 打开首页即可看到可操作的 Review 工作台。
- [ ] 点击示例按钮可以恢复内置示例 PR。
- [ ] 修改输入内容后，风险报告即时更新。
- [ ] `npm run test` 通过。
- [ ] `npm run build` 通过。
- [ ] README 包含依赖说明、原创范围、运行方式和 demo 链接位置。

## Technical Approach

MVP 采用纯前端实现，避免后端部署成本。核心 Review 逻辑放在 `src/lib/reviewEngine.ts`，React 层只负责输入、展示和交互。规则引擎以可扩展数组维护，每条规则包含分类、严重级别、检测函数和修复建议。

## Decision

Context：参赛作品需要快速可演示，同时要能体现架构清晰和测试覆盖。

Decision：使用 Vite + React + TypeScript + Vitest。AI 能力先以规则引擎和结构化生成模拟，后续再接入真实 LLM。

Consequences：MVP 可离线运行、复现稳定；不足是不能直接读取远程 PR，也不能做深层语义推理。这些能力列入后续规划。

## Out of Scope

- 不在 MVP 中接入 GitHub/Gitee OAuth。
- 不在 MVP 中调用真实大模型 API。
- 不在 MVP 中写入仓库评论或自动合并 PR。
- 不伪造历史 commit 或 PR 时间线。

## Technical Notes

- 当前工作区初始为空，不存在 `.trellis` 项目脚本或已有规范。
- 需要创建 PR 模板，帮助后续真实 PR 满足主办方格式要求。
- README 必须明确第三方依赖与原创功能部分。
