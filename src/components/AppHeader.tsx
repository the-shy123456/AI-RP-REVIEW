import { Download, Eraser } from "lucide-react";

interface AppHeaderProps {
  canDownload: boolean;
  onClear: () => void;
  onDownload: () => void;
}

export function AppHeader({
  canDownload,
  onClear,
  onDownload,
}: AppHeaderProps) {
  return (
    <section className="workspace-header">
      <div>
        <p className="eyebrow">AI PR Review Assistant</p>
        <h1>GitHub PR 自动审查助手</h1>
        <p className="intro">
          粘贴公开 GitHub PR 链接，自动拉取标题、描述和 diff，生成风险评分、审查意见和可复制报告。
        </p>
      </div>
      <div className="header-actions" aria-label="quick actions">
        <button
          aria-label="导出报告"
          className="icon-button"
          disabled={!canDownload}
          title="导出报告"
          onClick={onDownload}
        >
          <Download size={20} />
        </button>
        <button
          aria-label="清空输入"
          className="icon-button"
          title="清空分析"
          onClick={onClear}
        >
          <Eraser size={20} />
        </button>
      </div>
    </section>
  );
}
