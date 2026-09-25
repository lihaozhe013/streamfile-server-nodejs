# Behavior Specification

Agent contract for observable behavior. Any change to URLs, responses, file
access, configuration, build output, or distribution semantics must update this
file in the same change. If code and this document disagree, fix both.

## Runtime model

- Node.js 24+, ESM. The backend listens on `server.host:server.port`
  (default `0.0.0.0:3000`). There is no authentication, TLS, database, or user
  management.
- Runtime root: `STREAMFILE_ROOT_DIR` when set (the dev launchers set it to the
  repository root); otherwise the directory containing the running `server.js`.
  The process cwd is irrelevant.
- Configuration is `<runtime root>/config.yaml` only; parent directories are
  never searched. A missing file is generated from the packaged `default.yaml`
  (`src/backend/config/default.yaml`, copied to `dist/default.yaml` by the
  build). Existing files are never overwritten, even when invalid; invalid
  configuration fails startup with the validation error.
- Config requires `server.host` (non-empty string), `server.port` (integer
  1-65535), and non-empty `directories.public/upload/incoming/private`
  resolved relative to the runtime root.
- Startup creates `files/`, `files/incoming/`, and `files/private-files/`.
  When `public/404-index.html` exists, it is copied to
  `files/incoming/index.html` and `files/private-files/index.html` if missing.
- Logging is a best-effort append to `<runtime root>/debug.log`; write failures
  are swallowed. 5xx errors also emit `[backend_error]` to stderr. `LOG_LEVEL`
  is a reserved name only; no log-level override is implemented.

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
- `express.static` is mounted at both `/` and `/public`; both keep serving SPA
  assets. Unknown `/api/*` returns JSON `{error:'API endpoint not found'}`, never
  the SPA shell. Every other unmatched route returns the SPA shell.
- `public/index.html` must exist in production; a missing shell returns 500
  with an error telling the operator to run `pnpm build`.
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

- `pnpm build` -> `uv run build.py` -> `scripts/build/builder.py`: cleans
  `dist/public`, deletes `dist/server.js` and `dist/default.yaml`, typechecks
  the backend, bundles `src/backend/server.ts` with esbuild (ESM, minified) to
  `dist/server.js`, copies `src/backend/config/default.yaml` to
  `dist/default.yaml`, then
  typechecks the frontend and runs `vite build` into `dist/public`, finally
  verifying `server.js`, `default.yaml`, `public/index.html`, and
  `public/404-index.html` exist.
- Build-owned: `dist/server.js`, `dist/default.yaml`, `dist/public/**`.
  Runtime-owned and preserved by builds: `dist/config.yaml`, `dist/files/`,
  `dist/debug.log`.
- Production: `cd dist && node server.js`. The Dockerfile copies only `dist/`
  into `/app`; `.container/compose.yaml` mounts `config.yaml` and `files/`.
- CI (`.github/workflows/build.yml`) runs on pushes to the `build` branch, runs
  `pnpm install:all` and the Python build, and pushes Docker Hub tags `latest`
  and the repo-root `VERSION` value. Package versions do not drive the tag.

## Testing contract

- Backend (`src/backend/tests`): node:test via `tsx --test`. Each test builds a
  temporary runtime fixture and calls `createApp` on an ephemeral port; no
  shared config or network state.
- Frontend unit (`src/frontend/app/tests`): vitest, `environment: node`,
  alias `@` -> `src`.
- E2E (`src/frontend/app/e2e`): Playwright Chromium on 4173; only Vite is
  started and tests mock `/api/list-files` and `/upload`, so no backend is
  required. Browsers must be installed separately.
- `pnpm test` covers backend integration plus frontend unit;
  `pnpm test:e2e` runs browser tests only.

## Protected surface

Do not change these without an explicit request and a matching `spec.md` entry:

- Public URL shapes, percent-encoding, and `?raw=1` behavior.
- API response fields, status codes, and JSON error shape.
- File access tiers, hidden-entry semantics, and the file-symlink exception.
- Config generation/validation semantics and `dist/` runtime-file preservation.
- Legacy search URL compatibility and the `/public` static mount.
