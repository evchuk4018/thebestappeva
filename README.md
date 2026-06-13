# thebestappeva

This is a Vite + React app with workout, nutrition, AI chat, task management, notes, and a desktop-first Docs workspace.

## Local setup

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:3000`. If that port is already in use, `npm run dev` tries the next available port and prints the final URL. Set `PORT` in `.env` to choose a different starting port.
The Node host runs through `tsx watch`, so backend and shared-code changes restart it automatically. Generated data under `.local-data`, `dist`, and `node_modules` is excluded from restart watching.
The local Node host also creates a SQLite database for server-owned app persistence at `.local-data/thebestappeva.sqlite`. Override that path with `LOCAL_DB_PATH` when needed.

If you want the `/ai` tab to work, run Ollama locally and keep its API available at `http://127.0.0.1:11434`.
`npm run dev` now attempts to start the repo-owned SearXNG container automatically when Docker is available. If Docker is missing or the container stays unhealthy, the app still starts and only the web-search tools remain unavailable.
If you want local web search and page fetching in `/ai`, keep Docker available or start SearXNG manually at `http://127.0.0.1:8888`, or override `SEARXNG_BASE_URL`.
If you want a single AI-ready startup command, run `npm run ai:dev`. It ensures Ollama is reachable at `http://127.0.0.1:11434`, installs `qwen3.5:9b` if needed, requires Docker-backed SearXNG readiness, and then starts the app server. This command fails fast with instructions when Ollama or Docker is unavailable.
If you want local PDF, DOCX, and XLSX uploads in `/ai`, install Python 3 plus Docling locally:

```bash
python -m pip install -r python/requirements-docling.txt
```

On Windows, the app defaults to the `py -3` launcher for the parser sidecar. Override `AI_PARSER_PYTHON_COMMAND` or `AI_PARSER_PYTHON_ARGS` in `.env` if your local Python command differs.
PDF page images for the AI `pdf_reader` tool are rendered on demand with `AI_PDF_RENDER_SCALE`, defaulting to `1.5`.

## Validation

Run these checks before pushing changes:

```bash
npm run test:files
npm run lint
npm run build
```

`npm run test:files` enforces the repo rule that authored project files stay at or below 300 lines. It checks `src/**` plus owned root config and documentation files, and ignores generated or vendor content such as `node_modules`, `dist`, and `package-lock.json`.

For a production-style local smoke test, build first and then run:

```bash
npm run build
npm run preview
```

`npm run preview` does not auto-start Docker services in this pass.

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
- `/docs/:docId`: desktop-first document editor with server-backed SQLite persistence, autosave, unlimited version history, document tabs, outline, citations, voice typing, `.docx` export, print/PDF flow, and selected-text Ollama rewrites opened with `/`.

Implementation notes:

- Editor stack: `@tiptap/react`
- Local persistence: same-origin docs APIs backed by the repo-owned SQLite database
- AI rewrites: local Ollama flash-style requests with approve/reject preview flow
- `.docx` import: `mammoth`
- `.docx` export: `docx`

Existing browser-stored docs data is migrated once into the local SQLite workspace and then removed from IndexedDB/localStorage. The docs feature remains single-user with no collaboration or comments in this implementation.

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

The app now includes a `/ai` module backed by the local Ollama runtime with optional DeepSeek BYOK support:

- installed models are loaded from the local Ollama API and shown in the in-app model picker
- chats, per-chat mode, selected model, enabled tools, and custom system prompt persist in the local SQLite database through the repo-owned Node server
- new chats start with a heuristic sidebar title immediately, then attempt a one-time async retitle after the first completed exchange using local `qwen3.5:0.8b`; if that model is unavailable, the heuristic title remains
- the selected model preference is also reused by `/docs` for local selected-text rewrite actions
- the left sidebar now has `Chats` and `Tools` panels
- each chat has a mode toggle beside the model picker:
  - `Thinking` enables Ollama thinking, streams a collapsible `Thinking Progress` trace live, nudges long turns into explicit task/progress blocks, and keeps the final answer in the main reply bubble
  - `Flash` uses a single fast request with `think: false`, no tools, and streams only the final answer text
- the `Tools` panel lists installed tools, their functions, and an enable/disable toggle
- local starter tools now include `/date-time`, `/location`, `/timezone`, `/weather`, `/locale`, `/online-status`, and `/web-search`
- `/ai` now includes a Markdown artifact workspace with chat-linked artifacts, assistant-created artifact cards, bounded artifact context injection, line fetch/search/outline tools, version restore, structured table edits, and export into `/docs`
- long PDF uploads automatically expose `/pdf-reader` for that chat, with `search_pdf`, `read_pdf_pages`, `read_pdf_page`, and `view_pdf_page`
- weather supports both typed place queries and current-browser-location lookups, while location remains coordinates-only in this pass
- web search uses a local SearXNG instance through same-origin `/api/web-search`, and `fetch_url` uses `/api/fetch-url` to extract readable HTML page text
- tool calls are automatic in `Thinking` mode: the app sends enabled tools through Ollama's native tool-calling API, executes returned tool calls in the browser, and renders task maps, progress checkpoints, tool calls, tool results, and follow-up reasoning inside the same visible thinking trace before the final assistant reply
- `Thinking` mode now includes a first-party internal `ask_user` tool that can pause a turn, show a multiple-choice follow-up inline in the thinking trace or below the assistant reply, and then resume the same turn after the user explicitly sends an answer or skips
- answered and skipped `ask_user` prompts persist inside the assistant transcript, while prompts that were still pending during a page reload are normalized to skipped instead of trying to resume a dead turn
- streamed Ollama error events are surfaced to the user with the runtime's exact message instead of being collapsed into a generic invalid-JSON failure
- malformed streamed tool calls that end with Ollama's `unexpected end of JSON input` error are retried once without streaming; affected models then use non-streamed tool rounds for the rest of the browser session
- live `/ai` turns render an in-memory assistant bubble while the model is generating, including streamed thinking blocks and streamed final text, and the settled assistant message replaces that bubble when the turn finishes, fails, or is stopped
- in-progress streamed `/ai` output is not restored after a page reload; only the settled workspace state is persisted to the local SQLite store
- artifact bodies are stored outside chat payload JSON; chat persistence keeps only lightweight artifact metadata such as active and included artifact IDs plus assistant artifact cards
- PDFs with 1-3 pages are fully loaded into the model prompt and the assistant is told to mention that no PDF tool was needed; PDFs with 4+ pages or unknown page counts load summary context first and use `pdf_reader` on demand
- complete PDF audits use `read_pdf_pages`, which returns up to 25 consecutive pages per call; larger documents continue with explicit page bounds
- when a long PDF is submitted from `Flash`, that chat turn switches to `Thinking` so `pdf_reader` can run
- while a local AI turn is running, the composer swaps send for stop so the active `/ai` turn can be interrupted without leaving the page
- user prompts can be copied, edited, resent from their original point in the thread, and switched between persisted edit branches with compact version controls
- the composer paperclip now accepts local `.pdf`, `.docx`, and `.xlsx` uploads, parses them through a local Docling sidecar, and attaches the extracted content to the next AI turn
- failed local AI turns now surface inline in the conversation as explicit failed replies instead of only dropping the typing state and relying on the global banner
- assistant replies now render rich Markdown with GFM formatting, tables, task lists, fenced code blocks, and LaTeX math via `$...$` / `$$...$$`
- assistant replies now show copy and regenerate controls, plus placeholder thumbs-up and thumbs-down actions in the reply footer
- the `Add models` flow supports curated downloads and manual `model[:tag]` pulls without leaving the app
- the AI sidebar footer now opens a settings modal where custom system instructions persist in the local SQLite workspace, while the selected AI provider/model persist in browser localStorage and the built-in Markdown and tool guidance stay visible as read-only runtime context
- DeepSeek BYOK models are discovered from the server-side `GET /models` API and appear in the same model picker as local Ollama models

Implementation notes:

- Runtime: local Ollama HTTP API at `http://127.0.0.1:11434`
- DeepSeek BYOK runtime: server-side `GET /models` and `POST /chat/completions` against `https://api.deepseek.com` with `DEEPSEEK_API_KEY`
- AI-ready dev bootstrap: `npm run ai:dev`, which starts or connects to Ollama, ensures `qwen3.5:9b`, requires SearXNG readiness, and then launches the local app server
- Local persistence API: same-origin `GET /api/ai/workspace`, `PUT /api/ai/workspace`, and `GET /api/ai/preferences`, with AI provider/model selection mirrored server-side but sourced from browser localStorage on the client
- Local attachment parsing APIs: `GET /api/ai/attachments/health`, `POST /api/ai/attachments/parse`, `GET /api/ai/attachments/:id`, `GET /api/ai/attachments/:id/context`, and `DELETE /api/ai/attachments/:id`
- PDF reader APIs: `GET /api/ai/attachments/:id/pdf/search`, `GET /api/ai/attachments/:id/pdf/pages`, `GET /api/ai/attachments/:id/pdf/pages/:pageNumber`, and `GET /api/ai/attachments/:id/pdf/pages/:pageNumber/image`
- Local database: SQLite via `better-sqlite3`, defaulting to `.local-data/thebestappeva.sqlite`
- Local attachment storage: `.local-data/ai-attachments`
- Model discovery: `GET /api/tags` for Ollama and `GET /models` for DeepSeek BYOK
- Chat requests: `POST /api/chat`
- Model downloads: `POST /api/pull`
- Attachment parser sidecar: `python/docling_sidecar.py`, using Docling standard parsing locally on CPU
- System prompt assembly: shared browser-side builder under `src/components/ai-tab/system-prompt.ts`
- Tool execution: mixed local runtime under `src/components/ai-tab/tools`, attached through Ollama native function tools
- Internal clarification tool: browser-side `ask_user`, which pauses only `Thinking` turns and resumes them locally from persisted transcript state
- Artifact persistence: SQLite `ai_artifacts` and `ai_artifact_versions` tables with Markdown as the canonical storage format
- PDF page images are sent to Ollama as transient base64 `images` on the active tool response; chat history stores only metadata and text fallback
- Browser context tools: `navigator.geolocation`, `navigator.language`, `navigator.languages`, `navigator.onLine`, and optional Network Information API fields when supported
- Local proxy tools: same-origin `GET /api/web-search` and `GET /api/fetch-url`, served by the repo-owned Node host under `server/`
- Weather data: Open-Meteo geocoding + forecast APIs with no API key
- Web search backend: local SearXNG via Docker Compose, defaulting to `http://127.0.0.1:8888`
- `fetch_url` is still HTML-only; document uploads now use the dedicated attachment parser path instead of the web page fetcher

Artifact workflow notes:

- the model-facing artifact tool set is `create_artifact`, `fetch_artifact_lines`, `list_artifacts`, `update_artifact`, `search_artifact`, `get_artifact_outline`, `export_artifact_to_doc`, and `update_artifact_table`
- artifact creation in `Thinking` mode depends on the selected local model producing valid JSON tool calls for Ollama's native tool API
- long artifacts are not dumped back into prompts by default; included artifacts inject bounded Markdown context, heading outlines, and instructions to use search/line-fetch tools
- the `/ai` artifact panel opens as a wider resizable workspace with a preview/code toggle, transient in-panel search highlighting, autosave, table operations, and `/docs` export
- first export creates a linked `/docs` document; later exports update the linked doc unless the caller explicitly chooses a new doc

## Recent refactor

The oversized `TaskManager` and `AiTab` screens were split into orchestrator-style top-level components with extracted helpers and focused UI modules under:

- `src/components/task-manager`
- `src/components/ai-tab`
