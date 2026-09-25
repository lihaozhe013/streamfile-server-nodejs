# StreamFile Server NodeJS

StreamFile Server is a small Node.js file server with a React SPA for browsing
files, uploading content, viewing Markdown, and playing media. It serves the
local filesystem directly; there is no database, authentication, or user
management.

- `spec.md` is the authoritative behavior contract (URLs, API, access tiers,
  config, build).
- `AGENTS.md` describes the repository layout and agent workflow.

## Requirements

- Node.js 24 or newer
- pnpm
- uv for the default production build command (`build.py` uses only the Python
  standard library)

## Install

```bash
pnpm install:all
```

The backend creates `config.yaml` and the configured runtime directories on
first startup when they do not exist. The generated defaults use port 3000,
`files/` for uploads, and `public/` for the production SPA. To customize
development values, copy `config.yaml.example` to the repository root as
`config.yaml`. The local file is intentionally ignored by Git.

## Development

Start the backend and Vite together:

```bash
pnpm dev
```

Open `http://127.0.0.1:5173`. The development server proxies `/api`, `/upload`,
and raw `/files` requests to the backend on port 3000; other `/files` requests
are served by Vite itself. Override the proxy target with `BACKEND_URL`:

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
test suite uses Playwright on port 4173 with mocked APIs; install browsers with
`pnpm --dir src/frontend/app exec playwright install chromium` if needed.
`pnpm build` type-checks and bundles the backend, builds the Vite SPA directly
into `dist/public`, and verifies the required production files while preserving
runtime-owned files in `dist` (`config.yaml`, `files/`, `debug.log`).

## Production

```bash
pnpm build
cd dist
node server.js
```

The production server uses the directory containing `server.js` as its runtime
root, regardless of the current working directory. It reads or generates
`dist/config.yaml` and serves the SPA from `dist/public`. Production never
searches parent directories for configuration; copy `config.yaml.example` to
`dist/config.yaml` to customize it.

## Configuration

The configuration is resolved from the runtime root: the repository root during
development and `dist/` in production.

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

An existing configuration is never overwritten, including when it is invalid;
the backend reports the validation error so the file can be corrected. Runtime
directories are created after a valid configuration is loaded. The fallback
template is `src/backend/config/default.yaml` and is packaged next to
`server.js` as `default.yaml`.

## Containers and CI

`.container/Dockerfile` copies only `dist/` into the image;
`.container/compose.yaml` mounts `config.yaml` and `files/`. Pushes to the
`build` branch publish the image tagged with the repo-root `VERSION` file.

## Documentation

- `spec.md` — behavior contract and protected surface.
- `AGENTS.md` — repository map, commands, traps, verification.
