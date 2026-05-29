# AI PR Review Assistant

一个面向参赛场景的 AI PR Review 助手原型。它把 PR 标题、描述和 `git diff` 转换为结构化审查报告，帮助开发者在提交前发现安全、测试、可靠性和流程规范问题。

## Demo

- 在线演示链接：待部署后补充
- Demo 视频链接：待录制后补充

建议视频讲解顺序：

1. 展示输入 PR 标题、描述和 diff。
2. 展示风险评分、审查意见和变更文件分析。
3. 展示自动生成的 PR 描述、测试建议和交付检查。
4. 简述后续真实 PR 流程与 README 中的依赖说明。

## 核心功能

- PR 风险评分：根据内置规则和变更规模生成 0-100 风险分。
- 结构化审查意见：覆盖安全、测试、可靠性、可维护性和流程规范。
- 变更文件解析：从 git diff 中识别文件状态、增删行数量。
- PR 描述生成：按主办方要求生成“功能描述 / 实现思路 / 测试方式 / Review 关注点”。
- 测试与交付检查：提醒补充测试、README 依赖说明和主分支可运行要求。
- Markdown 报告导出：可把 Review 结果下载为评审记录或 PR 评论草稿。

## 原创功能范围

本项目原创实现：

- `src/lib/reviewEngine.ts` 中的 diff 解析、风险规则、评分模型和文案生成逻辑。
- React 工作台交互与信息架构。
- 面向参赛 PR 规范的交付检查清单。

第三方库用于工程搭建、UI 图标、测试和构建，不包含核心 Review 规则模型。

## 技术栈与依赖

- React 18.3.1：前端视图框架。
- TypeScript 5.7.3：类型约束和可维护性保障。
- Vite 5.4.14：开发服务器与构建工具。
- Vitest 2.1.8：单元测试框架。
- ESLint 9.19.0：代码规范检查。
- lucide-react 0.475.0：按钮与模块图标。

完整依赖版本以 `package.json` 和 `package-lock.json` 为准。

## 本地运行

```bash
npm install
npm run dev
```

默认访问：

```text
http://127.0.0.1:5173
```

## 质量验证

```bash
npm run test
npm run build
npm run lint
```

## 推荐 PR 拆分路线

为满足“全周期持续交付”和“小粒度 PR”要求，建议按真实开发时间持续提交，不要最后一天一次性导入代码。

1. PR 1：项目脚手架、README 初稿、PR 模板。
2. PR 2：diff 解析与变更文件统计。
3. PR 3：风险规则引擎与评分模型。
4. PR 4：Review 工作台 UI。
5. PR 5：PR 描述生成与测试建议。
6. PR 6：单元测试、边界用例和构建修复。
7. PR 7：Demo 视频链接、部署链接和最终文档润色。

每个 PR 都应包含清晰标题、功能描述、实现思路和测试方式。

## PR 描述模板

```markdown
## 功能描述

说明本 PR 新增或修改了什么，用户如何使用。

## 实现思路

说明技术选型、核心逻辑或关键模块。

## 测试方式

- [ ] npm run test
- [ ] npm run build
- [ ] 手动验证核心流程

## 备注

如复用历史代码片段，请注明来源；如引入新依赖，请同步更新 README。
```

## 参赛交付清单

- [ ] 公开 GitHub/Gitee 仓库。
- [ ] commit 时间戳在所选批次开始与截止时间之内。
- [ ] 保持持续 PR 和 commit 记录。
- [ ] 所有 PR 描述不为空且与代码变更一致。
- [ ] README 列明第三方依赖与原创功能范围。
- [ ] Demo 视频可公开访问，并在 README 中提供链接。
- [ ] 主分支任意时间保持可运行。

## 后续规划

- 支持粘贴 GitHub/Gitee PR URL 后自动获取 diff。
- 增加可配置规则集和团队自定义规范。
- 接入真实 LLM，对规则命中结果进行上下文解释和修复建议扩写。

## 项目文档

- `docs/PRD.md`：需求与验收标准。
- `docs/ARCHITECTURE.md`：架构设计与扩展点。
- `docs/REVIEW_RULES.md`：内置审查规则说明。
- `docs/DELIVERY_PLAN.md`：建议 PR 拆分与持续交付节奏。
- `docs/DEPLOYMENT.md`：部署与公开演示地址配置。
- `docs/REPOSITORY_SETUP.md`：公开仓库与真实 PR 流程说明。
- `docs/DEMO_SCRIPT.md`：Demo 视频讲解脚本。
