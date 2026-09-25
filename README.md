# StreamFile Server NodeJS

StreamFile Server is a small Bun-powered file server with a React SPA for
browsing files, uploading content, viewing Markdown, and playing media. It
serves the local filesystem directly; there is no database, authentication, or
user management.

- `spec.md` is the authoritative behavior contract (URLs, API, access tiers,
  config, build).
- `AGENTS.md` describes the repository layout and agent workflow.

## Requirements

- Bun 1.4 or newer (package manager, backend development, and production runtime)
- Node.js 24 or newer for the frontend tooling (Vite, Vitest, Playwright, `tsc`)

## Install

```bash
bun install
```

The backend creates `config.yaml` and the configured runtime directories on
first startup when they do not exist. The generated defaults use port 3000,
`files/` for uploads, and `public/` for the production SPA. To customize
development values, copy `config.yaml.example` to the repository root as
`config.yaml`. The local file is intentionally ignored by Git.

## Development

Start the backend and Vite together:

```bash
bun run dev
```

Open `http://127.0.0.1:5173`. The development server proxies `/api`, `/upload`,
and raw `/files` requests to the backend on port 3000; other `/files` requests
are served by Vite itself. Override the proxy target with `BACKEND_URL`:

```bash
BACKEND_URL=http://127.0.0.1:3001 bun run dev
```

The backend runs on Bun with `bun --watch`; the Vite dev server, Vitest, and
Playwright still run on Node. Run either side separately when needed:

```bash
bun run dev:backend
bun run dev:frontend
```

## Validation

```bash
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

`bun run test` runs backend integration tests under `bun test` and frontend
unit tests under Vitest. The browser test suite uses Playwright on port 4173
with mocked APIs; install browsers with
`bunx playwright install chromium` from `src/frontend/app` if needed.
`bun run build` type-checks both packages, bundles the backend with `Bun.build`,
builds the Vite SPA directly into `dist/public`, and verifies the required
production files while preserving runtime-owned files in `dist` (`config.yaml`,
`files/`, `debug.log`).

## Production

```bash
bun run build
cd dist
bun server.js
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
