# AGENTS.md

This repository is maintained by agents. Optimize for correctness and minimal
exploration: this file maps the repository, `spec.md` defines observable
behavior, and the code is the final source of truth for implementation details.

Read order:

1. `spec.md` — behavior contract (URLs, APIs, access tiers, config, build).
   Update it in the same change as any behavior change.
2. `AGENTS.md` — repository map, commands, traps, workflow (this file).
3. `README.md` — user quickstart. Not authoritative.

Deep dives belong in `docs/` only when they outgrow `spec.md`; link them here.

## Repository map

One Bun workspace rooted at `/` with a single `bun.lock`; `src/backend` and
`src/frontend/app` are workspace packages. `bun install` at the root installs
everything.

| Root               | Contents                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `/`                | orchestration scripts (`scripts/dev*.mjs`, `scripts/build/build.ts`), Prettier, `Makefile`  |
| `src/backend`      | Express 5 + TypeScript backend; `bun --watch` in dev, `bun test`, `Bun.build` in production |
| `src/frontend/app` | React 19 + Vite SPA; vitest and Playwright live here                                        |

Backend (`src/backend`):

- `server.ts` bootstrap; `app.ts` middleware order (files -> api -> upload ->
  static -> SPA fallback -> errors)
- `routes/files.ts` file serving; `routes/api.ts` JSON API; `routes/upload.ts`
  `POST /upload`
- `services/files.ts` path guards; `services/upload.ts` destinations and
  renames; `services/search.ts` search
- `config/index.ts` + `config/default.yaml`; `middleware/errors.ts`;
  `utils/logger.ts`
- `tests/*.test.ts` node:test integration tests executed by `bun test`

Frontend (`src/frontend/app`):

- `src/main.tsx` routes `/`, `/files/*`, `*`; `src/routes/fileRouteLoader.ts`
  selects the directory/markdown/media/resource view
- `src/lib/api.ts` HTTP client; `src/lib/paths.ts` kind and URL helpers;
  `src/lib/markdown.ts` relative asset rewriting
- `src/routes/MarkdownContent.tsx` markdown pipeline; `src/routes/FileRoute.tsx`
  directory/media/resource UI
- `tests/` vitest; `e2e/` Playwright

Runtime-owned and git-ignored (never commit, do not delete blindly): repo-root
`config.yaml`, `files/`, `public/`, `dist/`, `debug.log`.

## Commands

| Command                                | Purpose                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun install`                          | install every workspace package                                                          |
| `bun run dev`                          | backend (`bun --watch`, :3000) + Vite (:5173); sets `STREAMFILE_ROOT_DIR`, `BACKEND_URL` |
| `bun run dev:backend` / `dev:frontend` | run one side only                                                                        |
| `bun run typecheck`                    | `tsc --noEmit` in both packages                                                          |
| `bun run test`                         | backend `bun test` + frontend vitest                                                     |
| `bun run test:e2e`                     | Playwright on :4173 with mocked APIs (no backend needed)                                 |
| `bun run build`                        | `scripts/build/build.ts`: typecheck, `Bun.build` backend, Vite -> `dist/public`, verify  |
| `bun run format`                       | Prettier over the repository                                                             |

Ports: backend 3000, Vite dev 5173, Playwright 4173. Vite, Vitest, Playwright,
and `tsc` still run on Node 24+, so a Node installation is required for those
development tools even though production runs on Bun. Playwright browsers may
need `bunx playwright install chromium` from `src/frontend/app`.

## Task starting points

| Change                                    | Start here                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| file URLs, raw, tiers, symlinks           | `src/backend/routes/files.ts`, `src/backend/services/files.ts`, `src/backend/tests/app.test.ts`                                                |
| JSON API                                  | `src/backend/routes/api.ts`, `src/frontend/app/src/lib/api.ts`, tests                                                                          |
| uploads, mkdir, destinations              | `src/backend/routes/upload.ts`, `src/backend/services/upload.ts`, tests                                                                        |
| config, logging, startup, build packaging | `src/backend/config/index.ts`, `src/backend/server.ts`, `src/backend/config/default.yaml`, `src/backend/build/bundle-backend.ts`, config tests |
| directory, markdown, media UI             | `src/frontend/app/src/routes/`, `src/frontend/app/src/lib/paths.ts`, `e2e/`                                                                    |
| build, release, containers                | `scripts/build/build.ts`, `.container/`, `.github/workflows/build.yml`, `VERSION`                                                              |

## Guardrails

- `spec.md` lists the compatibility surface. Do not change public URLs, API
  response shapes or status codes, access tiers, or `?raw=1` semantics unless
  the task explicitly authorizes it.
- `files/incoming/` stays unreachable through listings, APIs, and downloads.
  `files/private-files/` stays hidden from listings and search but is served by
  direct URL. There is no authentication anywhere: never describe
  `private-files` as access control.
- Never weaken traversal, directory-symlink, upload-destination, or SPA
  fallback protections. Regular-file symlinks under `files/` are intentionally
  served even when their targets are outside the file root.
- Keep unknown `/api/*` JSON 404s separate from the SPA fallback.
- Keep `server.ts`, `app.ts`, and route coordinators thin; backend behavior
  goes into routes and services with tests.
- Logs go to `debug.log` in the runtime root, never stdout. Keep the stable
  bracketed prefixes (`[backend_server]`, `[backend_config]`, `[upload]`,
  `[global_dev]`, `[backend_dev]`) so log lines stay filterable. `LOG_LEVEL` is
  a reserved name only; no log-level override exists today.
- `dist/config.yaml`, `dist/files/`, and `dist/debug.log` are runtime-owned and
  must survive builds; `dist/server.js`, `dist/default.yaml`, and
  `dist/public/**` are build-owned.

## Traps

- Express 5 wildcard syntax is `/{*splat}`; async route handlers must catch and
  forward errors (see `asyncHandler` in `routes/api.ts`).
- Production runtime root is the directory containing `server.js`, not the cwd.
  The Bun bundle reads `default.yaml` from its own directory; keep the packaging
  step in `build/bundle-backend.ts` in sync.
- The bundle and backend runtime use Bun globals (`Bun.build`, `Bun.YAML`,
  `Bun.Glob`); run backend tests with `bun test` and production with `bun`, not
  Node. The `dist/server.js` bundle is Bun-only.
- Config is never searched upward and never overwritten (even invalid files are
  preserved and fail startup). Missing config is generated from
  `config/default.yaml`.
- The dev SPA runs on :5173 and Vite answers non-raw `/files` requests itself;
  only `?raw=1` reaches the backend. Verify file-serving changes on :3000 or
  through `bun run test`.
- E2E tests mock `/api/list-files` and `/upload`; they do not exercise the real
  backend.
- Multer decodes `originalname` from latin1 to utf8; removing that breaks
  Unicode filenames.
- Media extension lists exist in both `src/backend/utils/isMediaExtension.ts`
  and `src/frontend/app/src/lib/paths.ts`; keep them in sync.
- `/api/search` returns absolute `file_path` values and answers invalid search
  paths with HTTP 200 `{error}`; both are existing behavior.
- `.gitignore` ignores the root `public/` directory only; `src/frontend/public/`
  is the Vite static directory and must stay tracked.
- `VERSION`, not `package.json`, drives the Docker image tag in CI.
- Local `files/` may contain symlinks to files outside the repository. Treat
  its contents as user data.
- `/files/<dir>/` serves a custom `index.html` when present instead of the SPA.

## Verification and handoff

| Change            | Run                                                                                |
| ----------------- | ---------------------------------------------------------------------------------- |
| backend behavior  | `bun run typecheck`, `bun run test`; add `bun run build` for bundle/config changes |
| frontend behavior | `bun run typecheck`, `bun run test`, `bun run test:e2e`                            |
| docs only         | Prettier on changed files                                                          |

Regression-prone cases: Unicode names, spaces, nested paths, deep SPA
refreshes, API failures, raw files, uploads, and protected directories. When
handing off a debug session, provide a ready-to-run command that exercises the
flow and filters `debug.log` into a focused file instead of relying on terminal
output.

- Run Prettier on changed files and `git diff --check` before handoff.
- Use Conventional Commits; English only in code, docs, and commits. No emojis.
- Do not commit generated output (`dist/`, root `public/`, `files/`, logs,
  `config.yaml`, test reports).
- Keep files under 1000 lines; split by responsibility rather than growing
  entry points.
