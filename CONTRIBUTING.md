# Contributing

## Development

```bash
npm install
npm run dev
```

## Quality Gate

Before opening a PR:

```bash
npm run test
npm run build
npm run lint
```

## Pull Request Rules

- One PR should cover one feature or one focused change.
- Keep the PR description aligned with the actual code change.
- Include feature description, implementation notes, and test method.
- Update README when adding dependencies.
- Add or update tests when changing review rules.
- Keep `main` runnable after every merge.
