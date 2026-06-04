# thebestappeva

This is a Vite + React app with workout, nutrition, AI chat, task management, notes, and a desktop-first Docs workspace.

## Local setup

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`.

If you want the `/ai` tab to work, run Ollama locally and keep its API available at `http://127.0.0.1:11434`.

## Validation

Run these checks before pushing changes:

```bash
npm run test:files
npm run lint
npm run build
```

`npm run test:files` enforces the repo rule that authored project files stay at or below 300 lines. It checks `src/**` plus owned root config and documentation files, and ignores generated or vendor content such as `node_modules`, `dist`, and `package-lock.json`.

## Structure rules

The repo policy lives in `agent.md`.

- Keep files modular.
- Extract functions and components so each does one thing.
- Keep authored project files at or below 300 lines.
- Update documentation when a task changes behavior, structure, or developer workflow.

## Docs workspace

The app now includes a `/docs` module with:

- `/docs`: template gallery, recent files, local search, `.docx` import, trash, duplicate, rename, and star actions.
- `/docs/new`: blank-document creation redirect.
- `/docs/:docId`: desktop-first document editor with local IndexedDB persistence, autosave, version history, document tabs, outline, citations, voice typing, `.docx` export, and print/PDF flow.

Implementation notes:

- Editor stack: `@tiptap/react`
- Local persistence: `Dexie` / IndexedDB
- `.docx` import: `mammoth`
- `.docx` export: `docx`

Documents are stored locally in the browser for a single user. There is no collaboration, comments, or server-side sync in the current implementation.

## Notes workspace

The app now includes a `/notes` module with:

- `/notes`: mobile-first quick capture, local search, pinned notes, quick-note filtering, and task-category-linked note organization
- local IndexedDB persistence for title/body/tag/category metadata
- seeded starter notes so the workspace is usable on first launch

Implementation notes:

- Local persistence: `Dexie` / IndexedDB
- Project grouping source: existing task `category` values
- Editing model: plain text note editor optimized for fast capture

## AI workspace

The app now includes a `/ai` module backed by the local Ollama runtime:

- installed models are loaded from the local Ollama API and shown in the in-app model picker
- chats, per-chat mode, selected model, and enabled tools persist in `localStorage`
- the left sidebar now has `Chats` and `Tools` panels
- each chat has a mode toggle beside the model picker:
  - `Thinking` enables Ollama thinking and shows the returned reasoning trace in a collapsible block
  - `Flash` uses a single fast request with `think: false`, no tools, and no visible reasoning
- the `Tools` panel lists installed tools, their functions, and an enable/disable toggle
- browser-side starter tools now include `/date-time`, `/location`, `/timezone`, `/weather`, `/locale`, and `/online-status`
- weather supports both typed place queries and current-browser-location lookups, while location remains coordinates-only in this pass
- tool calls are automatic in `Thinking` mode: the app sends enabled tools through Ollama's native tool-calling API, executes returned tool calls in the browser, and renders tool calls, tool results, and follow-up reasoning inside the same visible thinking trace before the final assistant reply
- while a local AI turn is running, the composer swaps send for stop so the active `/ai` turn can be interrupted without leaving the page
- failed local AI turns now surface inline in the conversation as explicit failed replies instead of only dropping the typing state and relying on the global banner
- assistant replies now render rich Markdown with GFM formatting, tables, task lists, fenced code blocks, and LaTeX math via `$...$` / `$$...$$`
- the `Add models` flow supports curated downloads and manual `model[:tag]` pulls without leaving the app
- the AI sidebar footer now opens a settings modal where custom system instructions persist in `localStorage`, while the built-in Markdown and tool guidance stays visible as read-only runtime context

Implementation notes:

- Runtime: local Ollama HTTP API at `http://127.0.0.1:11434`
- Model discovery: `GET /api/tags`
- Chat requests: `POST /api/chat`
- Model downloads: `POST /api/pull`
- System prompt assembly: shared browser-side builder under `src/components/ai-tab/system-prompt.ts`
- Tool execution: browser-only runtime under `src/components/ai-tab/tools`, attached through Ollama native function tools
- Browser context tools: `navigator.geolocation`, `navigator.language`, `navigator.languages`, `navigator.onLine`, and optional Network Information API fields when supported
- Weather data: Open-Meteo geocoding + forecast APIs with no API key
- This pass remains frontend-only with no backend proxy routes or provider keys

## Recent refactor

The oversized `TaskManager` and `AiTab` screens were split into orchestrator-style top-level components with extracted helpers and focused UI modules under:

- `src/components/task-manager`
- `src/components/ai-tab`
