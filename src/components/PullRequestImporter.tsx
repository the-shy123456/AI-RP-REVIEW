import { Github, Loader2, Search } from "lucide-react";

interface PullRequestImporterProps {
  error: string;
  loading: boolean;
  onAnalyze: () => void;
  onUrlChange: (value: string) => void;
  sourceUrl?: string;
  title?: string;
  url: string;
}

export function PullRequestImporter({
  error,
  loading,
  onAnalyze,
  onUrlChange,
  sourceUrl,
  title,
  url,
}: PullRequestImporterProps) {
  return (
    <aside className="input-panel" aria-label="pull request importer">
      <div className="panel-heading">
        <h2>PR 链接</h2>
        <span>GitHub 公开 PR</span>
      </div>
      <section className="import-card">
        <Github size={28} />
        <div>
          <strong>粘贴 GitHub PR 链接后自动分析</strong>
          <p>
            系统会读取 PR 标题、描述和 diff，再生成风险评分、审查意见、测试建议和可复制报告。
          </p>
        </div>
      </section>
      <label>
        GitHub PR URL
        <input
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAnalyze();
            }
          }}
          placeholder="https://github.com/owner/repo/pull/123"
        />
      </label>
      <button
        className="primary-action"
        disabled={loading || !url.trim()}
        onClick={onAnalyze}
        type="button"
      >
        {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
        {loading ? "正在拉取 PR" : "分析 PR"}
      </button>
      {error && <p className="error-note">{error}</p>}
      {sourceUrl && (
        <section className="imported-pr">
          <span>当前 PR</span>
          <strong>{title}</strong>
          <a href={sourceUrl} rel="noreferrer" target="_blank">
            打开 GitHub PR
          </a>
        </section>
      )}
    </aside>
  );
}
