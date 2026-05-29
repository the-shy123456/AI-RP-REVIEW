import { Download, Eraser, PlayCircle } from "lucide-react";

interface AppHeaderProps {
  onClear: () => void;
  onDownload: () => void;
  onLoadSample: () => void;
}

export function AppHeader({
  onClear,
  onDownload,
  onLoadSample,
}: AppHeaderProps) {
  return (
    <section className="workspace-header">
      <div>
        <p className="eyebrow">AI PR Review Assistant</p>
        <h1>结构化 PR 审查工作台</h1>
        <p className="intro">
          输入 PR 标题、描述和 git diff，自动生成风险评分、审查意见、测试建议和规范 PR 描述。
        </p>
      </div>
      <div className="header-actions" aria-label="quick actions">
        <button
          aria-label="加载示例"
          className="icon-button"
          title="加载示例"
          onClick={onLoadSample}
        >
          <PlayCircle size={20} />
        </button>
        <button
          aria-label="导出报告"
          className="icon-button"
          title="导出报告"
          onClick={onDownload}
        >
          <Download size={20} />
        </button>
        <button
          aria-label="清空输入"
          className="icon-button"
          title="清空输入"
          onClick={onClear}
        >
          <Eraser size={20} />
        </button>
      </div>
    </section>
  );
}
