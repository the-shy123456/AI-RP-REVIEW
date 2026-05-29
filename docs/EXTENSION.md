# Browser Extension

项目包含一个 Manifest V3 浏览器插件版本，目录为 `extension/`。

## 功能

- 在 GitHub PR 页面自动注入 AI PR Review 面板。
- 点击“分析当前 PR”后读取当前 PR 的标题、描述和 `.diff`。
- 在 GitHub 页面内展示风险等级、风险分、文件数量和审查意见。

## 本地加载

Chrome / Edge：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择仓库中的 `extension/` 目录。
5. 打开公开 GitHub PR 页面，点击右下角面板中的“分析当前 PR”。

## 说明

插件版本复用了与网页端一致的核心规则思路。当前实现为了便于比赛演示，把规则逻辑打包在 `extension/content.js` 中；后续可以通过构建脚本复用 `src/lib/reviewEngine.ts`，避免双份规则维护。
