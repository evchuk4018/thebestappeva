# AGENTS.md

High-signal notes for OpenCode sessions working in this repo. See `README.md` for feature docs and `agent.md` for the repo policy.

## Commands

- `npm run dev` — starts Vite dev server via `tsx watch`. Auto-bootstraps SearXNG (Docker) and repo-local Ollama (`.local-bin/ollama`) on Windows; the app still starts if either fails. Default port 3000, falls through to next free port; set `PORT` in `.env`.
- `npm run ai:dev` — strict AI-ready variant: requires Ollama + `qwen3.5:9b` + SearXNG readiness, else fails fast with instructions.
- `npm run build` — `vite build` (client bundle into `dist/`).
- `npm run preview` — runs built bundle through `server/index.ts --preview`. Does NOT auto-start Docker/Ollama.
- `npm run lint` — `tsc --noEmit`. This is the only typecheck; there is no separate `typecheck` script.
- `npm run test:files` — enforces the 300-line limit across `src/**` plus owned root files (`README.md`, `agent.md`, `index.html`, `metadata.json`, `package.json`, `tsconfig.json`, `vite.config.ts`, `public/manifest.json`, `.env.example`). Ignores `node_modules`, `dist`, `package-lock.json`, generated content.
- `npm test` — runs `test:files` then `test:pdf-reader` (a curated `tsx --test` invocation over ~50 test files).
- `npm run test:image-analysis-smoke` — standalone smoke test for the image-analysis sidecar path.
- `npm run searxng:up` / `searxng:down` — manual SearXNG container control.

### Running a single test

Tests use the Node built-in runner through `tsx --test`. Run one file directly:

```
npx tsx --test server/ai-memory.test.ts
```

The `test:pdf-reader` script is just a hardcoded list of `*.test.ts` paths passed to `tsx --test`; there is no glob/test-name filter, so prefer invoking individual files as above.

### Suggested verification order before pushing

`npm run test:files` -> `npm run lint` -> `npm run build`.

## Layout

- `src/` — React 19 client. Largest surfaces live under `src/components/ai-tab` (AI chat + tools + artifacts) and `src/components/task-manager`. Editor stack is TipTap; rich text rendering via `react-markdown` + KaTeX.
- `server/` — Express app (`server/app.ts`) started by `server/index.ts`. Hosts `/api/*` endpoints, serves Vite in dev, and owns SQLite via `better-sqlite3`.
- `shared/` — contract tests and types shared between client and server; treat as the integration boundary.
- `python/` — sidecars invoked by the server: `docling_sidecar.py` (PDF/DOCX/XLSX), `image_analysis_sidecar.py` (persistent OpenCV/RapidOCR worker), `exec_sidecar.py` (sandboxed `python.exec` tool). On Windows the server defaults to `py -3`; override per sidecar with the `AI_PARSER_PYTHON_*`, `AI_IMAGE_ANALYSIS_PYTHON_*`, `AI_PYTHON_EXEC_*` env vars.
- `scripts/bootstrap/` — dev runtime bootstrapping (Ollama, SearXNG, app server). `scripts/check-file-lengths.mjs` backs the 300-line rule.
- `.local-data/` — SQLite DB (`thebestappeva.sqlite`) and AI attachment storage; gitignored, regenerated at runtime.
- `.local-bin/` — repo-local Ollama install on Windows; gitignored.

## Conventions and gotchas

- Path alias `@/*` maps to repo root (configured in `tsconfig.json`); use it for cross-package imports.
- Authored project files must stay at or below 300 lines (see `agent.md` and `test:files`). New files in `src/**` are automatically subject to the check; root-level authored files must be added to `ROOT_FILES` in `scripts/check-file-lengths.mjs` to be checked.
- `lint` is `tsc --noEmit` only — no ESLint/biome. Type errors are the gate; match existing formatting style manually.
- Tailwind v4 is wired through `@tailwindcss/vite` (see `vite.shared.ts` / `vite.config.ts`), not a PostCSS config.
- Secrets stay server-side: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` live in `.env` and are never exposed to the browser. Provider/model/vision-mode selection mirrors server-side but is sourced from browser localStorage on the client.
- AI tooling is optional at runtime: `npm run dev` degrades gracefully without Ollama/Docker; only `/ai` features and web-search become unavailable. Don't assume sidecar or container availability in tests.
- Tests intentionally do not require Docker/Ollama/Python; they exercise contracts and pure logic. Keep that property when adding tests.
- `package.json` `name` is `react-example` (legacy); the real project name is `thebestappeva`.