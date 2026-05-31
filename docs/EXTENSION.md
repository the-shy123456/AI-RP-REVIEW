# Browser Extension

项目包含一个 Manifest V3 浏览器插件版本，目录为 `extension/`。

## 功能

- 在 GitHub PR 页面自动注入 AI PR Review 面板。
- 支持从插件面板点击“登录 GitHub”，复用网页端 OAuth 授权代理读取 PR，避免匿名接口 403。
- 点击“分析当前 PR”后读取当前 PR 的标题、描述和 `.diff`。
- 在 GitHub 页面内展示风险等级、风险分、文件数量和审查意见。
- 在插件面板内配置并保存第三方大模型 `BASE_URL`、`API_KEY`、`MODEL` 和协议。
- 直接在 GitHub 页面发起 AI 代码评审，输出代码质量分、总体评价、问题列表和合并建议。
- AI 评审失败后可直接点击“重试”，无需刷新 GitHub 页面。

## 本地加载

Chrome / Edge：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择仓库中的 `extension/` 目录。
5. 打开公开 GitHub PR 页面，点击右下角面板中的“分析当前 PR”。
6. 如果遇到 GitHub 403，在插件面板点击“登录 GitHub”，通过 `https://chige.9e.nz` 完成 OAuth 授权。授权完成页会提示回到 GitHub PR 页面，插件会自动刷新授权状态。
7. 如需 AI 代码评审，在面板顶部填写大模型配置并点击“保存配置”，然后切到“AI 代码评审”页签。

## 权限说明

- `storage`：保存插件内的大模型配置，刷新 GitHub 页面后继续可用。
- `https://api.github.com/*`：读取公开 PR metadata 和 diff。
- `https://chige.9e.nz/*`：复用公网 Web 端 GitHub OAuth 会话和 PR 读取代理。
- `https://*/*` / `http://*/*`：允许后台服务请求用户配置的 OpenAI-compatible 第三方大模型接口。

## 说明

插件版本复用了与网页端一致的核心规则思路和 AI 评审输出结构。当前实现为了便于比赛演示，把规则逻辑打包在 `extension/content.js` 中，把大模型请求代理放在 `extension/background.js` 中；后续可以通过构建脚本复用 `src/lib/reviewEngine.ts` 和 `server/aiReviewCore.mjs`，避免双份规则维护。
