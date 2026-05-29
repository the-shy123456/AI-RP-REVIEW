interface PullRequestEditorProps {
  description: string;
  diff: string;
  onDescriptionChange: (value: string) => void;
  onDiffChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  title: string;
}

export function PullRequestEditor({
  description,
  diff,
  onDescriptionChange,
  onDiffChange,
  onTitleChange,
  title,
}: PullRequestEditorProps) {
  return (
    <aside className="input-panel" aria-label="pull request input">
      <div className="panel-heading">
        <h2>PR 输入</h2>
        <span>本地离线分析</span>
      </div>
      <label>
        PR 标题
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="feat: add review dashboard"
        />
      </label>
      <label>
        PR 描述
        <textarea
          className="description-input"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="说明功能作用、使用方式、实现思路和测试方式"
        />
      </label>
      <label className="diff-label">
        Git diff
        <textarea
          className="diff-input"
          value={diff}
          onChange={(event) => onDiffChange(event.target.value)}
          spellCheck={false}
          placeholder="粘贴 git diff 或 PR patch 内容"
        />
      </label>
    </aside>
  );
}
