# Deployment

## Local Preview

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Production Build

```bash
npm run build
npm run preview
```

The static output is generated in `dist/`.

## GitHub Pages

This repository includes `.github/workflows/pages.yml`.

After pushing to GitHub:

1. Open repository Settings.
2. Go to Pages.
3. Set source to GitHub Actions.
4. Push to `main` or manually run "Deploy GitHub Pages".
5. Copy the Pages URL into README Demo section.

The Vite `base` is configured as `./`, so the built assets work under a repository subpath.

## Gitee or Cloud Disk Demo

If using Gitee or another static hosting provider:

1. Run `npm run build`.
2. Upload the `dist/` directory.
3. Verify the public URL can be opened without login.
4. Add the URL to README.
