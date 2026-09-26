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

On first startup the backend creates `~/.config/stream-file-server/config.yaml`
and the data directories under `~/.local/stream-file-server/`. All platforms
use the same home-based layout; on Linux and macOS `$HOME` relocates it, which
is how the Docker image redirects everything.

## Development

Start the backend and Vite together:

```bash
bun run dev
```

Open `http://127.0.0.1:5173`. The development server proxies `/api`, `POST /upload`,
and raw `/files` requests to the backend on port 3000; other `/files` requests
and the upload page are served by Vite itself. Override the proxy target with `BACKEND_URL`:

```bash
BACKEND_URL=http://127.0.0.1:3001 bun run dev
```

Development uses the real home layout: configuration is read from
`~/.config/stream-file-server/config.yaml` and uploads land in
`~/.local/stream-file-server/files/`. The dev launchers also create minimal
SPA stubs (with a `.streamfile-dev-stub` marker) in
`~/.local/stream-file-server/public/`; packaged servers automatically ignore
that directory, so locally built binaries keep serving their embedded assets.
Delete the marker file to promote the directory into a real public override.

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
bun run build:binaries
```

`bun run test` runs backend integration tests under `bun test` and frontend
unit tests under Vitest. The browser test suite uses Playwright on port 4173
with mocked APIs; it runs headed locally and headless when `CI` is set, and
browsers can be installed with `bunx playwright install chromium` from
`src/frontend/app` if needed.

`bun run build` type-checks both packages, bundles the backend with `Bun.build`
(config template inlined), builds the Vite SPA into `dist/public`, and verifies
the required production files.

## Production

```bash
bun run build
cd dist
bun server.js
```

Configuration always resolves through the home-based layout regardless of the
working directory; production never searches parent directories. To customize,
copy `config.yaml.example` to `~/.config/stream-file-server/config.yaml`.

## Standalone binaries

```bash
bun run build:binaries
```

Compiles four single-file executables into `dist/bin/` —
`streamfile-server-<version>-windows-x64.exe`, `-linux-x64`, `-linux-arm64`,
and `-darwin-arm64` — each with the SPA assets embedded. Copy one anywhere and
run it; on first start it creates its config under `~/.config/stream-file-server/`
and stores data under `~/.local/stream-file-server/`. Setting `$HOME` (or
`%USERPROFILE%` on Windows) relocates both.

## Configuration

```yaml
server:
  host: '0.0.0.0'
  port: 3000

features:
  upload: true
  privateFiles: true
  homePage: true

directories:
  public: '~/.local/stream-file-server/public'
  upload: '~/.local/stream-file-server/files'
  incoming: '~/.local/stream-file-server/files/incoming'
  private: '~/.local/stream-file-server/files/private-files'
```

Directory values support `~/` expansion; absolute paths pass through, and
relative paths resolve against `~/.local/stream-file-server/`.
`directories.public` is optional: when the directory contains an `index.html`
(and no `.streamfile-dev-stub` marker) it overrides the bundled/embedded SPA
(custom themes), otherwise the packaged assets are served.

An existing configuration is never overwritten, including when it is invalid;
the backend reports the validation error so the file can be corrected. Runtime
directories are created after a valid configuration is loaded.

Feature flags are optional and default to `true` when omitted, including in
existing configuration files. Set `upload: false` to disable uploads and
directory creation, `privateFiles: false` to block direct access to the hidden
private directory while keeping its files on disk, or `homePage: false` to
redirect `/` to `/files/`. The private directory provides no authentication.
Restart the server and reload browser tabs after changing flags. Custom public
asset overrides must adapt their own UI; the backend still enforces the flags.

## Containers and CI

`.container/Dockerfile` copies `dist/server.js` and `dist/public/` into an
`oven/bun` image and sets `HOME=/app/data`. `.container/compose.yaml` mounts
the host home directories so container and native installs share one layout:

```yaml
volumes:
  - ~/.config/stream-file-server:/app/data/.config/stream-file-server
  - ~/.local/stream-file-server:/app/data/.local/stream-file-server
```

Requires Docker Compose v2.21+ for `~` expansion; `${HOME}/...` works on older
versions. The container runs as root, so files it creates in the mounted
directories are root-owned on Linux; add a `user:` override if that matters.

Pushes to the `build` branch publish the image tagged with the repo-root
`VERSION` file and upload the standalone binaries as a versioned artifact.

## Documentation

- `spec.md` — behavior contract and protected surface.
- `AGENTS.md` — repository map, commands, traps, verification.
