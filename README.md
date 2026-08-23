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
```

The backend creates `config.yaml` and the configured runtime directories on
first startup when they do not exist. The generated defaults use port 3000,
`files/` for uploads, and `public/` for the production SPA. The development
launcher sets the repository-root public directory automatically. To customize
the values before starting, copy `config.yaml.example` to `config.yaml` and
edit it. The local file is intentionally ignored by Git.

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
cd dist
node server.js
```

The production server listens on the host and port configured in `config.yaml`.
If the file is absent, it is generated in `dist/` with port 3000 and the SPA is
served from `dist/public`.

## Configuration

`config.yaml` contains the server bind address and runtime directory paths. The
example file documents the supported fields:

```yaml
server:
  host: '0.0.0.0'
  port: 3000

directories:
  public: 'public'
  upload: 'files'
  incoming: 'files/incoming'
  private: 'files/private-files'
```

An existing configuration is never overwritten, including when it is invalid.
The backend reports the validation error so the file can be corrected. Runtime
directories are created after a valid configuration is loaded. Generated
configuration events are recorded in the untracked `debug.log` file when it is
possible to write that file. The backend fallback template is maintained at
`src/backend/config/default.yaml` and is packaged with production builds.

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
root by default. Regular-file symlinks located under `files/` are an explicit
exception: they are listed and served, including when their targets are
outside the configured file root. Symlinked directories, broken links, and
links to files inside `incoming/` remain inaccessible. Do not create links to
secrets or other sensitive local files. Hidden files are excluded from listings
and search results.

## API

- `GET /api/list-files?path=<path>`
- `GET /api/search?q=<name>&dir=<directory>`
- `GET /api/markdown-content?path=<path>`
- `POST /upload` with a multipart `file` field

API routes return JSON errors and are not handled by the SPA fallback.
