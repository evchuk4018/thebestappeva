# thebestappeva

This is a Vite + React app with workout, nutrition, AI chat, and task management screens.

## Local setup

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`.

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

## Recent refactor

The oversized `TaskManager` and `AiTab` screens were split into orchestrator-style top-level components with extracted helpers and focused UI modules under:

- `src/components/task-manager`
- `src/components/ai-tab`
