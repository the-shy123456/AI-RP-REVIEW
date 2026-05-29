# Repository Setup

## Initialize and Push

This workspace has already been initialized as a local Git repository on `main`.

Create a public GitHub or Gitee repository, then connect it:

```bash
git remote add origin <your-public-repo-url>
git add .
git commit -m "chore: bootstrap AI PR review assistant"
git push -u origin main
```

## Continuous PR Practice

For the competition, keep future work in real PRs:

```bash
git switch -c feat/diff-parser
# make focused changes
git add .
git commit -m "feat: add diff parser"
git push -u origin feat/diff-parser
```

Open a PR from the branch and fill the template. After merge, start the next small branch.

## Important

- Do not rewrite commit timestamps.
- Do not create fake PR history.
- Keep every PR focused on one feature.
- Keep README updated when dependencies, demo links, or original feature scope changes.
