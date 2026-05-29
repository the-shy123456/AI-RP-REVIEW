import type { ReviewInput } from "./reviewEngine";

export interface GitHubPullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
  url: string;
}

interface GitHubPullRequestResponse {
  body: string | null;
  html_url: string;
  number: number;
  title: string;
}

export class PullRequestImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PullRequestImportError";
  }
}

export function parseGitHubPullRequestUrl(value: string): GitHubPullRequestRef {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new PullRequestImportError("请输入有效的 GitHub PR 链接。");
  }

  if (url.hostname !== "github.com") {
    throw new PullRequestImportError("目前只支持 github.com 的公开 PR 链接。");
  }

  const [, owner, repo, pullSegment, numberSegment] = url.pathname.split("/");
  const pullNumber = Number(numberSegment);

  if (!owner || !repo || pullSegment !== "pull" || !Number.isInteger(pullNumber)) {
    throw new PullRequestImportError(
      "链接格式应类似：https://github.com/owner/repo/pull/123",
    );
  }

  return {
    owner,
    repo,
    pullNumber,
    url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
  };
}

export async function fetchGitHubPullRequest(
  ref: GitHubPullRequestRef,
  fetcher: typeof fetch = fetch,
): Promise<ReviewInput> {
  const apiUrl = `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.pullNumber}`;

  const [metadataResponse, diffResponse] = await Promise.all([
    fetcher(apiUrl, { headers: { Accept: "application/vnd.github+json" } }),
    fetcher(apiUrl, { headers: { Accept: "application/vnd.github.v3.diff" } }),
  ]);

  if (!metadataResponse.ok) {
    throw new PullRequestImportError(
      `无法读取 PR 元数据，GitHub 返回 ${metadataResponse.status}。请确认仓库和 PR 公开可访问。`,
    );
  }

  if (!diffResponse.ok) {
    throw new PullRequestImportError(
      `无法读取 PR diff，GitHub 返回 ${diffResponse.status}。请确认该 PR 公开可访问。`,
    );
  }

  const metadata = (await metadataResponse.json()) as GitHubPullRequestResponse;
  const diff = await diffResponse.text();

  if (!diff.trim()) {
    throw new PullRequestImportError("该 PR diff 为空，暂时无法分析。");
  }

  return {
    description: metadata.body ?? "",
    diff,
    mode: "competition",
    sourceUrl: metadata.html_url,
    title: metadata.title || `${ref.owner}/${ref.repo}#${ref.pullNumber}`,
  };
}

export async function importGitHubPullRequest(
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<ReviewInput> {
  const ref = parseGitHubPullRequestUrl(value);
  return fetchGitHubPullRequest(ref, fetcher);
}
