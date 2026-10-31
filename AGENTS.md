<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EduVideo AI

Hackathon project: converts educational PDFs / study notes into narrated explainer videos with slides and a quiz. **Education theme only.** Deadline is 4 PM — prioritize a working prototype over extra features.

## Current state

- **Phase 2:** polished dashboard shell for `/`, `/create`, `/videos`, `/settings` plus a FastAPI backend for PDF upload and text extraction.
- `/create` uploads real PDFs to the backend, shows upload progress, extracted-text preview, and clear errors. Notes-only generation is still disabled; it never fabricates a lesson.
- `src/lib/api.ts` is the only frontend client for the backend (`NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8000`). Use `XMLHttpRequest` for upload progress.
- Backend endpoints: `GET /health`, `POST /api/upload-pdf` (multipart field `file`), `POST /api/extract-text` (`{ "document_id": "..." }`).
- Errors use `{"detail": {"code": "...", "message": "..."}}`; the UI shows the message directly.
- Gemini, TTS, slide rendering, FFmpeg assembly, and quiz generation are **not implemented**. `backend/services/lesson_service.py` is a placeholder.
- `src/lib/data.ts` contains clearly labeled sample videos for dashboard/library previews. Play/download stay disabled unless a real `videoUrl` exists.

## Commands

Run from the repo root:

```bash
npm install        # already installed
npm run dev        # Next.js dev server on http://localhost:3000
npm run build      # production build; also runs TypeScript checking
npm run lint       # ESLint flat config (eslint.config.mjs)
npx tsc --noEmit   # standalone typecheck (no npm script exists)
```

Backend (first run):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
```

No test runner is configured. Verify changes with `npm run lint && npm run build` and by curling `/`, `/create`, `/videos`, `/settings` plus the backend endpoints.

## Frontend structure

- `src/app/layout.tsx` — root `html`/`body`/metadata only.
- `src/app/(dashboard)/` — route group (does not change URLs): shared layout + `page.tsx` = `/`, `create/`, `videos/`, `settings/`.
- `src/components/` — `sidebar.tsx` (client nav), `page-header.tsx`, `video-card.tsx`, `video-thumbnail.tsx`, `status-badge.tsx`, `empty-state.tsx`, plus client flows `create-video-form.tsx`, `video-library.tsx`, `settings-form.tsx`.
- `src/lib/types.ts` — domain types (`Video`, `Lesson`, `LessonScene`, `QuizQuestion`); `src/lib/data.ts` — labeled sample videos/stats; `src/lib/format.ts` — date/duration/file-size helpers; `src/lib/api.ts` — backend client and `ApiError`.
- `src/app/globals.css` defines reusable component classes (`@layer components`): `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.hint`, `.badge`. Reuse them instead of repeating utility chains.
- Import via the `@/*` alias (maps to `src/*`).

## Backend structure

- `backend/main.py` — FastAPI app, CORS, lifespan, `/health`, `/api/upload-pdf`, `/api/extract-text`.
- `backend/config.py` — paths and env defaults (`MAX_UPLOAD_MB=20`, `MIN_EXTRACTED_CHARS=20`, `CORS_ORIGINS`).
- `backend/database.py` — SQLite metadata helpers; DB at `backend/data/eduvideo.db`.
- `backend/services/pdf_service.py` — PDF validation, size limit, PyMuPDF extraction, OCR/encrypted errors.
- `backend/services/lesson_service.py` — placeholder only; do not add Gemini here yet.
- Uploads/extractions are stored under `backend/storage/uploads/` and `backend/storage/extracted/` (gitignored).
- Pinned versions: FastAPI 0.162.0, Uvicorn 0.54.0, Pydantic 2.14.2, python-multipart 0.0.32, PyMuPDF 1.28.2.

## Next.js 16 / Tailwind 4 quirks

- Read the bundled docs in `node_modules/next/dist/docs/` before writing code; training data may be wrong for this version.
- `LayoutProps<"/">` and `PageProps<"/route">` are globally generated types. `params` and `searchParams` are **Promises** (await them).
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`. Uncached/dynamic data must sit inside `<Suspense>` or the build fails.
- Tailwind v4: **no** `tailwind.config.js` and no PostCSS config. CSS is loaded by the `@tailwindcss/turbopack` rule in `next.config.ts`; theme tokens live in `src/app/globals.css` (`@theme inline`).
- `next dev` rewrites the Next.js block at the top of this file. Keep it in commits.

## Environment gotchas (verified)

- macOS arm64 (Apple M4), Node 24 / npm 11, Python 3.14.3.
- Python 3.14 works with the pinned backend deps (PyMuPDF uses a `cp310-abi3` arm64 wheel). Keep using the pinned venv (`backend/.venv`); check wheels for Pillow and Piper before adding them.
- `ffmpeg` and `ffprobe` are **not installed**; Phase 5 needs them. Install via `brew install ffmpeg` first.
- `GEMINI_API_KEY` must live in backend env only. Never use `NEXT_PUBLIC_` for secrets and never call Gemini from the browser. Missing key should surface a clear error, not fallback content.

## Product constraints

- No HeyGen and no paid video-generation services; use real Gemini.
- One video generation at a time; no authentication.
- Keep backend modules separate: PDF extraction, lesson generation, TTS, slide rendering, FFmpeg assembly, quiz generation.
- Use clear loading and error states in the UI.
- Sample content must be labeled; never enable fake play/download controls without a real `videoUrl`.
