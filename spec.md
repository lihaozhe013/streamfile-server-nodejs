# Behavior Specification

Agent contract for observable behavior. Any change to URLs, responses, file
access, configuration, build output, or distribution semantics must update this
file in the same change. If code and this document disagree, fix both.

## Runtime model

- Bun 1.4+ runs the backend, bundle, binaries, and backend tests; the frontend
  tooling (Vite, Vitest, Playwright, `tsc`) still runs on Node.js 24+. ESM. The
  backend listens on `server.host:server.port` (default `0.0.0.0:3000`). There
  is no authentication, TLS, database, or user management.
- All platforms use one home-based layout derived from `os.homedir()`:
  configuration lives at `~/.config/stream-file-server/config.yaml` and the
  data root at `~/.local/stream-file-server/` (holds `files/`,
  `files/incoming/`, `files/private-files/`, and `debug.log`). The process cwd
  is irrelevant. On Linux/macOS `os.homedir()` honors `$HOME`, which is how
  containers relocate everything (the Docker image sets `HOME=/app/data`).
- Configuration is that single file only; parent directories are never
  searched. A missing file is generated from the template embedded in the
  backend (`src/backend/config/default.yaml` inlined via
  `with { type: 'text' }`; there is no on-disk template artifact). Existing
  files are never overwritten, even when invalid; invalid configuration fails
  startup with the validation error.
- Config requires `server.host` (non-empty string), `server.port` (integer
  1-65535), and non-empty `directories.upload/incoming/private`.
  `directories.public` is optional. Directory values resolve as: absolute
  paths pass through, a leading `~/` expands to the home directory, and
  relative paths resolve against the data root. The template ships with
  explicit `~/.local/stream-file-server/...` values.
- Public assets resolve in order: (1) the configured public directory when it
  exists on disk (operator override/theme); (2) otherwise the `public`
  directory next to the entry point — `dist/public` for `bun dist/server.js`,
  or the asset tree embedded in a standalone executable via
  `bun build --compile --asset` (import.meta.dir based). When only the
  embedded source exists, `paths.publicEmbedded` is true and assets are served
  through a custom router reading via `Bun.file()` because `send`'s streaming
  cannot read embedded files.
- Startup creates `files/`, `files/incoming/`, and `files/private-files/`
  under the data root. When the resolved public source provides
  `404-index.html`, its contents are written to `files/incoming/index.html`
  and `files/private-files/index.html` if missing.
- Logging is a best-effort append to `<data root>/debug.log`; write failures
  are swallowed. 5xx errors also emit `[backend_error]` to stderr. `LOG_LEVEL`
  is a reserved name only; no log-level override is implemented.
- Tests and callers can inject `loadRuntimeConfig({ homeDir, configPath })`;
  there are no `STREAMFILE_*` environment variables.

## File access contract

| Location                 | Listing and search                | Direct URL                    |
| ------------------------ | --------------------------------- | ----------------------------- |
| `files/` non-dot entries | yes                               | served                        |
| `files/private-files/`   | no (403 on listing, not searched) | served                        |
| `files/incoming/`        | no (403 on listing, not searched) | 403                           |
| dot-prefixed entries     | no                                | served when targeted directly |

`/files/<path>` handling order (`src/backend/routes/files.ts`):

1. Malformed percent-encoding -> 400 JSON. Path escaping `files/` -> 403.
2. Path inside `incoming/` -> 403. Missing path -> 404 with `404-index.html`.
3. Directory: directory symlinks or realpaths escaping `files/` -> 404;
   otherwise a safe `<dir>/index.html` is served if present, else the SPA shell.
4. File: inaccessible or broken -> 404. `?raw=1` -> file bytes. `.md` and known
   media extensions -> SPA shell. Anything else (images, text, archives) ->
   file bytes.

- Regular-file symlinks under `files/` are intentionally served even when the
  real target is outside the file root; links whose target is inside
  `incoming/` stay blocked. Directory symlinks and broken links stay
  inaccessible. Do not weaken or "fix" this without an explicit request.
- Public assets are mounted at both `/` and `/public` via
  `createPublicAssetRouter` (`src/backend/services/publicAssets.ts`): disk
  sources use `express.static`; embedded sources use a `Bun.file()`-based
  router. Both keep serving SPA assets. Unknown `/api/*` returns JSON
  `{error:'API endpoint not found'}`, never the SPA shell. Every other
  unmatched route returns the SPA shell.
- `public/index.html` must exist in production; a missing shell returns 500
  with an error telling the operator to run `bun run build`.
- `?raw=1` is the only raw switch; `?raw=true` is not recognized.

## HTTP API

Errors are JSON `{ "error": string }`.

- `GET /api/list-files?path=<relative>` (path optional, default root): returns
  `FileEntry[]` = `{name, isDirectory}`. 400 invalid path, 403
  incoming/private, 500 `Failed to read directory` when stat fails.
- `GET /api/search?q=<name>&dir=<relative>`: `q` required (400 otherwise);
  returns `{query, results, count}` where `query` is `{file_name, current_dir}`
  and each result is `{file_name, file_path, relative_path}`. `file_path` is
  absolute; `relative_path` is POSIX-style. Invalid, protected, or missing `dir`
  returns HTTP 200 with `{error:'Invalid search path'}`. Matching is a
  case-insensitive substring on basenames, recursive, excluding dot entries and
  protected directories.
- `GET /api/search/file_name=<name>/current_dir=<dir>`: legacy URL that must
  keep working and return the same payload.
- `GET /api/markdown-content?path=<relative .md>`: returns
  `{content, filename, path}` where `path` is POSIX-relative. 400 missing or
  invalid path, 403 incoming, 404 for non-`.md` or inaccessible files.
- `POST /api/mkdir` with JSON `{path}`, body limit 16kb: returns
  `{created, relativePath}`; an existing directory returns `created:false`.
  Rejects empty, `.`, traversal, dot segments, and incoming/private targets
  with 400.

## Upload contract

`POST /upload`, multipart fields `file` (required) and optional `destination`.

- Files are staged in `incoming/` first; `originalname` is re-decoded from
  latin1 to utf8 and reduced to a basename.
- `destination` omitted or empty: the file stays in `incoming/`; the response
  is `{message, file}` with no `relativePath`/`url`, and the file is
  unreachable through file URLs (legacy inbox).
- `destination='.'` or a relative path: validated against traversal, dot
  segments, and real paths inside incoming/private; missing directories are
  created. The response adds `relativePath` and a percent-encoded `url`.
- Collisions never overwrite: names become `name (1).ext`, `name (2).ext`, ...
  via a hard-link EEXIST retry with an exclusive-copy fallback across
  filesystems.
- Rejected uploads are deleted from staging. Errors are JSON 400/500. No upload
  size limit is configured.

## Frontend contract

- Routes: `/` home and upload, `/files/*` data route, `*` not found.
  `src/routes/fileRouteLoader.ts` classifies by extension: `md` -> markdown
  page, media set -> media player, otherwise directory listing; a failed
  listing falls back to a resource page.
- `image` extensions are linked directly to `/files/<path>` (no `?raw=1`) and
  rendered by the browser; backend serves them as bytes.
- Markdown pipeline order is `remarkGfm`, `remarkMath`, then rehype
  `raw -> sanitize -> katex` in `MarkdownContent.tsx`. Relative links and
  images resolve against the current file and get `?raw=1` for assets.
- Dev proxy (`vite.config.ts`): `/api` and `/upload` go to `BACKEND_URL`
  (default `http://127.0.0.1:3000`); `/files` is proxied only for `?raw=1`,
  other `/files` requests are answered by Vite itself.

## Build, distribution, release

- `bun run build` -> `scripts/build/build.ts`: cleans `dist/public` and
  `dist/server.js` (also deleting a legacy `dist/default.yaml`), typechecks
  the backend, bundles `src/backend/server.ts` with `Bun.build` (target `bun`,
  ESM, minified) to `dist/server.js` with the config template inlined, then
  typechecks the frontend and runs `vite build` into `dist/public`, finally
  verifying `server.js`, `public/index.html`, and `public/404-index.html`
  exist.
- `bun run build:binaries` -> `scripts/build/build-binaries.ts`: runs
  `bun run build` first, then compiles `dist/server.js` with
  `Bun.build({ compile: { assets: ['public'] } })` (cwd `dist`, minified) into
  `dist/bin/streamfile-server-<VERSION>-<target>` for `bun-windows-x64`,
  `bun-linux-x64`, `bun-linux-arm64`, and `bun-darwin-arm64`. Each executable
  embeds the whole SPA; no runtime files ship beside it. Binaries are also
  Bun-only.
- Build-owned: `dist/server.js`, `dist/public/**`, `dist/bin/**`. Runtime
  state (config, files, logs) never lives in `dist/`; it always resolves
  through the home-based layout. Legacy `dist/config.yaml`, `dist/files/`, and
  `dist/debug.log` are ignored by the new mechanism.
- Production: `cd dist && bun server.js`. The `dist/server.js` bundle is
  Bun-only (it carries the `// @bun` pragma and `import.meta.require` interop),
  so Node.js cannot execute it. The Dockerfile copies `dist/server.js` and
  `dist/public/` into `/app` of an `oven/bun` image and sets `HOME=/app/data`;
  `.container/compose.yaml` mounts the host `~/.config/stream-file-server` and
  `~/.local/stream-file-server` directories at the matching paths under
  `/app/data`, so the container shares the same layout as a native binary.
- CI (`.github/workflows/build.yml`) runs on pushes to the `build` branch with
  `oven-sh/setup-bun` (plus Node.js for Vite, Vitest, Playwright, and `tsc`),
  runs `bun install --frozen-lockfile`, `bun run test`, the Bun build, and
  `bun run build:binaries`, uploads `dist/bin/*` as a versioned artifact, and
  pushes Docker Hub tags `latest` and the repo-root `VERSION` value. Package
  versions do not drive the tag.

## Testing contract

- Backend (`src/backend/tests`): node:test files executed by `bun test` in the
  Bun runtime. Each test builds a temporary runtime fixture and calls `createApp`
  on an ephemeral port; no shared config or network state. Config tests inject
  isolated homes via `loadRuntimeConfig({ homeDir, configPath })`.
- Frontend unit (`src/frontend/app/tests`): vitest on Node, `environment: node`,
  alias `@` -> `src`.
- E2E (`src/frontend/app/e2e`): Playwright Chromium on 4173; only Vite is
  started and tests mock `/api/list-files` and `/upload`, so no backend is
  required. Browsers must be installed separately. Playwright runs headed by
  default and headless when `CI` is set (`CI=1 bun run test:e2e`).
- `bun run test` covers backend integration plus frontend unit;
  `bun run test:e2e` runs browser tests only.

## Protected surface

Do not change these without an explicit request and a matching `spec.md` entry:

- Public URL shapes, percent-encoding, and `?raw=1` behavior.
- API response fields, status codes, and JSON error shape.
- File access tiers, hidden-entry semantics, and the file-symlink exception.
- Config generation/validation semantics and the home-based path layout.
- Legacy search URL compatibility and the `/public` static mount.
