import type { ChangedFile } from "../lib/reviewEngine";

interface ChangedFilesPanelProps {
  files: ChangedFile[];
}

export function ChangedFilesPanel({ files }: ChangedFilesPanelProps) {
  return (
    <aside className="files-panel" aria-label="changed files">
      <div className="panel-heading">
        <h2>变更文件</h2>
        <span>{files.length} files</span>
      </div>
      <div className="file-list">
        {files.length === 0 ? (
          <p className="muted-note">粘贴 git diff 后会显示文件列表。</p>
        ) : (
          files.map((file) => (
            <article className="file-row" key={`${file.path}-${file.status}`}>
              <div>
                <strong>{file.path}</strong>
                <span>{file.status}</span>
              </div>
              <p>
                +{file.additions} / -{file.deletions}
              </p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
