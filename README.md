# StreamFile Server NodeJS

StreamFile Server is a small Node.js file server with a React SPA for browsing
files, uploading content, viewing Markdown, and playing media. It uses the
local filesystem and does not require a database or authentication service.

## Requirements

- Node.js 24 or newer
- pnpm
- uv for the default production build command

## Install

```bash
pnpm install:all
cp config.yaml.example config.yaml
```

`config.yaml` is local configuration and is intentionally ignored by Git. For
repository-root development, set `directories.public` to
`src/frontend/public`. The committed example uses `public`, which is the
correct path when the server runs from `dist/`.

## Development

Start the backend and Vite together:

```bash
pnpm dev
```

Open `http://127.0.0.1:5173`. The development server proxies `/api`, `/upload`,
and raw `/files` requests to the backend on port 3000. Override the proxy target
with `BACKEND_URL`:

```bash
BACKEND_URL=http://127.0.0.1:3001 pnpm dev
```

Run either side separately when needed:

```bash
pnpm dev:backend
pnpm dev:frontend
```

## Validation

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test` runs backend integration tests and frontend unit tests. The browser
test suite uses Playwright. `pnpm build` type-checks and bundles the backend,
builds the Vite SPA, and copies runtime assets into `dist/public`.

## Production

```bash
pnpm build
cp config.yaml.example dist/config.yaml
cd dist
node server.js
```

The production server listens on the host and port configured in `config.yaml`.
The default template uses port 3000 and serves the generated SPA from
`dist/public`.

## Supported Scope

The SPA provides:

- Home page and upload flow with progress reporting.
- Directory browsing, breadcrumbs, search, and browser history navigation.
- Markdown rendering with GFM, math, KaTeX, sanitized HTML, relative assets,
  and a table of contents.
- Audio and video playback with Video.js, playback rates, seeking, fullscreen,
  and keyboard controls.
- Direct raw-file access through `/files/<path>?raw=1`.

Public routes include `/`, `/files/`, nested `/files/<path>/` directories,
Markdown files at `/files/<path>.md`, and media files at `/files/<media>`.

## File Access

| Directory              | Listing | Direct access                 |
| ---------------------- | ------- | ----------------------------- |
| `files/`               | Public  | Allowed                       |
| `files/private-files/` | Hidden  | Allowed when the URL is known |
| `files/incoming/`      | Blocked | Not allowed                   |

The server rejects traversal and symlink paths that escape the configured file
root. Hidden files are excluded from listings and search results.

## API

- `GET /api/list-files?path=<path>`
- `GET /api/search?q=<name>&dir=<directory>`
- `GET /api/markdown-content?path=<path>`
- `POST /upload` with a multipart `file` field

API routes return JSON errors and are not handled by the SPA fallback.
