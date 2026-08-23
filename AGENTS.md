# Agents

Documentation for agents working on this codebase.

## Project Overview

**StreamFile Server NodeJS** is a lightweight, cross-platform file server with
file browsing, uploads, Markdown previews, and media playback. It has no
database.

- **Packages**: `src/backend` and `src/frontend/app`
- **Package manager**: pnpm
- **TypeScript**: 7.x
- **Runtime**: Node.js 24+; Vite 8 requires Node.js 20.19+ or 22.12+

## Project Structure

```text
streamfile-server-nodejs/
├── src/backend/                 # Express server and file APIs
│   ├── server.ts                # Runtime startup and shutdown
│   ├── app.ts                   # Testable Express app factory
│   ├── config/                  # YAML loading and runtime paths
│   ├── routes/                  # Files, APIs, and uploads
│   ├── services/                # Safe file access and async search
│   ├── middleware/              # Shared error handling
│   ├── build/                   # esbuild bundle script
│   └── tests/                   # Backend integration tests
├── src/frontend/app/            # Unified React SPA
│   ├── src/components/          # Shell, navigation, shared UI
│   ├── src/lib/                 # Typed API and path/Markdown helpers
│   ├── src/routes/               # Home, files, Markdown, media routes
│   ├── src/styles/              # Tailwind/PostCSS application styles
│   ├── tests/                   # Vitest unit tests
│   └── e2e/                     # Playwright browser tests
├── src/frontend/public/         # Runtime static assets and Vite output
├── scripts/build/               # Python build orchestration
├── dist/                        # Production output
├── build.py                     # Root build entry
└── config.yaml                  # Local runtime configuration
```

## Build and Development

```bash
pnpm install:all
pnpm typecheck
pnpm test
pnpm build
cd dist && node server.js
```

Development servers:

```bash
pnpm dev
```

The global dev command starts the backend on port 3000 and the Vite server on
port 5173. Vite proxies API and raw file requests to the backend. Use
`BACKEND_URL=http://127.0.0.1:3001 pnpm dev` when the backend uses a different
port, or run `pnpm dev:backend` and `pnpm dev:frontend` separately.

`pnpm build` runs backend type checking, bundles the backend, type checks and
builds the SPA with Vite, then copies `src/frontend/public` to `dist/public`.
The SPA build uses route-level chunks; Markdown and Video.js are not loaded on
the home page.

## Frontend Architecture

The app uses React Router Data Mode with a browser history and keeps the public
URL surface:

- `/` — home and upload
- `/files/` — directory browser
- `/files/<path>/` — nested directory browser
- `/files/<path>.md` — Markdown viewer
- `/files/<media>` — media player

The React app fetches data from `/api/list-files`, `/api/search`, and
`/api/markdown-content`. Uploads use `POST /upload` with XHR so progress events
remain available.

Express serves the built SPA shell for UI routes. It still serves direct files,
custom directory `index.html` files, and `/files/<path>?raw=1` without routing
them through React. API paths must remain JSON endpoints and must not be caught
by the SPA fallback.

## Validation

- `pnpm typecheck` runs TypeScript 7 `tsc --noEmit` for backend and frontend.
- `pnpm test` runs backend integration tests and frontend Vitest tests.
- `pnpm test:e2e` runs Playwright browser tests.
- ESLint is intentionally not used; the repository relies on TypeScript checks
  and automated tests.

## File Access Tiers

| Directory              | Visibility           | Access                        |
| ---------------------- | -------------------- | ----------------------------- |
| `files/`               | Public               | Browser, direct URL, and APIs |
| `files/private-files/` | Hidden from listings | Direct URL only               |
| `files/incoming/`      | Blocked              | Upload staging only           |

Do not weaken these boundaries while changing routing or the SPA fallback.

## Formatting and Dependencies

Use pnpm and keep code comments and documentation in English. Run
`pnpm format` for Prettier formatting. Frontend dependencies include React 19,
React Router 8, Vite 8, TypeScript 7, Tailwind CSS 4, React Markdown, KaTeX,
Video.js, Vitest, and Playwright.
