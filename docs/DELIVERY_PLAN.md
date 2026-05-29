# Delivery Plan

参赛要求强调持续 PR 和 commit 记录。当前仓库提供完整 MVP，但正式提交时应按真实开发节奏拆分，不要临近截止一次性导入。

## 建议 PR 节奏

| PR | Scope | Description |
| --- | --- | --- |
| PR 1 | Project setup | Vite、React、TypeScript、测试和 lint 基础工程。 |
| PR 2 | Diff parser | 实现 `parseChangedFiles` 并补单元测试。 |
| PR 3 | Rule engine | 实现风险规则、评分模型和摘要生成。 |
| PR 4 | Workbench UI | 搭建输入区、指标区、审查报告区和文件区。 |
| PR 5 | Report generation | 生成 PR 描述、测试建议、交付清单和 Markdown 导出。 |
| PR 6 | Documentation | README、PRD、架构、规则说明和 demo 脚本。 |
| PR 7 | Polish and demo | 录制视频、补充部署链接、修复演示反馈。 |

## 每个 PR 的最低要求

- 标题一句话说明新增或修改内容。
- 描述包含功能描述、实现思路、测试方式。
- 只做一件事，避免把不相关改动塞进同一 PR。
- 合并后主分支保持可运行。
- 如引入新依赖，更新 README。
- 如复用历史代码片段，在 PR 描述中注明来源。

## 推荐分支命名

- `feat/diff-parser`
- `feat/rule-engine`
- `feat/review-workbench`
- `feat/report-export`
- `docs/demo-materials`

## 注意

不要伪造历史 commit 或 PR。比赛规则要求的是全周期真实开发记录，后续公开仓库时应保留真实时间线。
