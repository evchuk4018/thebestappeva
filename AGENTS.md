# AGENTS.md

- Keep this file aligned with `agent.md`: OpenCode loads `AGENTS.md`, while `README.md` and `npm run test:files` still reference `agent.md`.

## Commands

- `npm run dev` starts the Node host in dev mode (`server/index.ts` + Vite middleware). It tries to bootstrap SearXNG, Ollama, and `python.exec`, but continues if those checks fail.
- `npm run ai:dev` is the strict startup path: it requires Ollama model `qwen3.5:9b`, SearXNG, and `python.exec` readiness before the app starts.
- `npm run lint` is `tsc --noEmit`; there is no separate ESLint or typecheck command.
- `npm run db:up`, `npm run db:down`, and `npm run db:reset` manage the local Postgres 17 dev/test containers. `npm run db:test` runs the focused Postgres infrastructure tests.
- `npm test` runs `test:files` plus a long hardcoded `tsx --test` file list. For focused work, run one file directly with `npx tsx --test path/to/file.test.ts`.
- Production-style smoke test: `npm run build` then `npm run preview`. `preview` serves `dist/` through `server/index.ts --preview` and does not bootstrap Docker or Ollama.
- Suggested verification order before handoff: `npm run test:files` -> `npm run lint` -> `npm run build`.

## Boundaries

- `src/App.tsx` is the route map for `/ai`, `/docs`, `/calendar`, `/workout`, and `/nutrition`; workspace code lives under `src/components/*`.
- `server/app.ts` is the API wiring entrypoint. Add or change HTTP routes there, and keep storage logic in `server/db/*`.
- `shared/*` is the client/server contract boundary. Update shared contracts when request or response shapes change.
- Runtime data is local-first: Postgres is required at startup through `DATABASE_URL`; existing feature repositories still use SQLite at `.local-data/thebestappeva.sqlite` until their migration phase. Attachments and Python exec workspaces stay under `.local-data/`.

## Gotchas

- `@/` resolves to the repo root, not `src/`.
- The 300-line rule is enforced by `scripts/check-file-lengths.mjs` only for `src/**` plus specific root files; `server/**` and `python/**` are not checked by that script.
- `vite.shared.ts` disables HMR and file watching when `DISABLE_HMR=true`; keep that path intact because it is used during agent edits.
- Python sidecars default to `py -3` on Windows and `python3` elsewhere. Install `python/requirements-docling.txt` for document parsing and image-analysis support.
- Keep tests service-independent: the current test suite is written not to require Docker, Ollama, or local Python availability.
- Update docs when behavior, developer workflow, or repo structure changes.
- Never use the browser tool as visual verification for this repo.
