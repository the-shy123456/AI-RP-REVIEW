import { describe, expect, it, vi } from "vitest";
import {
  PullRequestImportError,
  fetchGitHubPullRequest,
  importGitHubPullRequest,
  parseGitHubPullRequestUrl,
} from "./githubPullRequest";

describe("parseGitHubPullRequestUrl", () => {
  it("parses canonical GitHub PR URLs", () => {
    expect(
      parseGitHubPullRequestUrl("https://github.com/openai/codex/pull/42"),
    ).toEqual({
      owner: "openai",
      repo: "codex",
      pullNumber: 42,
      url: "https://github.com/openai/codex/pull/42",
    });
  });

  it("rejects non PR URLs", () => {
    expect(() =>
      parseGitHubPullRequestUrl("https://github.com/openai/codex/issues/42"),
    ).toThrow(PullRequestImportError);
  });
});

describe("fetchGitHubPullRequest", () => {
  it("fetches metadata and diff for a public PR", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            body: "实现 PR URL 导入",
            html_url: "https://github.com/acme/app/pull/7",
            number: 7,
            title: "feat: import pull request",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
+export const ok = true;`,
          { status: 200 },
        ),
      );

    await expect(
      fetchGitHubPullRequest(
        {
          owner: "acme",
          repo: "app",
          pullNumber: 7,
          url: "https://github.com/acme/app/pull/7",
        },
        fetcher,
      ),
    ).resolves.toMatchObject({
      description: "实现 PR URL 导入",
      mode: "competition",
      sourceUrl: "https://github.com/acme/app/pull/7",
      title: "feat: import pull request",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/app/pulls/7",
      expect.any(Object),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/app/pulls/7",
      { headers: { Accept: "application/vnd.github.v3.diff" } },
    );
  });

  it("surfaces GitHub API failures", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(
      importGitHubPullRequest("https://github.com/acme/app/pull/404", fetcher),
    ).rejects.toThrow("无法读取 PR 元数据");
  });
});
