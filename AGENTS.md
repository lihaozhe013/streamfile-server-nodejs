# AGENTS.md

This repository is a pnpm-managed Node.js application with an Express file
server and a React/Vite single-page frontend. Keep the implementation focused
on file browsing, uploads, Markdown viewing, media playback, and the existing
public HTTP interfaces.

## 1. Language

- All source-code comments, doc comments, commit messages, and newly created or
  updated documentation MUST be written in English.
- Chinese text MUST NOT be added to comments or engineering documentation. When
  touching existing non-English comments or documentation, translate the
  affected text to English in the same change.
- Localized user-facing strings are exempt. Keep localization content separate
  from engineering documentation whenever practical.
- Names and prose MUST clearly explain intent. Do not add comments that merely
  restate the code.

## 2. Tooling and Commands

- Use pnpm for JavaScript and TypeScript dependencies and scripts.
- Prefer `rg` and `fd` for repository searches. Use `uv run` for Python build
  entry points.
- Use `apply_patch` for source and documentation edits.
- Keep TypeScript 7, Node.js 24+, React, Vite, and the existing package
  boundaries unless the task explicitly changes them.
- Run Prettier on changed files and use `tsc --noEmit` for type validation.
- Do not add ESLint or another linter unless the task explicitly requires one.

## 3. Compatibility and Safety

- Preserve existing public URLs, API paths, response shapes, file access tiers,
  and the `?raw=1` direct-file behavior unless a task explicitly authorizes a
  breaking change.
- Keep `files/private-files/` hidden from listings but available through known
  direct URLs. Keep `files/incoming/` inaccessible through browsing, APIs, and
  direct downloads.
- Never weaken path traversal, symlink, upload, or SPA fallback protections.
- Do not read, print, commit, or hard-code credentials, tokens, private keys,
  or local secrets.
- Do not use destructive commands against broad paths. Prefer recoverable
  operations and verify exact targets first.

## 4. Testing and Verification

- Backend changes require backend type checks and integration tests.
- Frontend changes require frontend type checks and relevant unit or browser
  tests.
- The standard validation commands are:

  ```bash
  pnpm typecheck
  pnpm test
  pnpm test:e2e
  pnpm build
  ```

- Test Unicode names, spaces, nested paths, deep SPA refreshes, API failures,
  raw files, uploads, and protected directories when those behaviors are
  affected.

## 5. Logging and Debugging

- Application logs MUST be written to `debug.log` by default. Running the
  application MUST NOT require stdout or stderr redirection to capture logs.
- Normal application logging MUST NOT write to the terminal. Startup must
  remain resilient if the log file cannot be created.
- `LOG_LEVEL` may be used as an optional log-level override, but the
  application MUST provide a useful default without it.
- Never log passwords, tokens, private keys, credentials, local secrets, or
  complete user-provided paths when they may contain sensitive information.
- Logs added for a feature or investigation MUST use a stable prefix such as
  `[backend_server]` or `[global_dev]` so they can be filtered reliably.
- When handing off a debugging workflow, provide a ready-to-run command that
  exercises the relevant flow and filters `debug.log` into a focused log file.
  For example:

  ```bash
  pnpm dev &
  dev_pid=$!
  trap 'kill "$dev_pid"' EXIT
  curl -fsS http://127.0.0.1:5173/
  rg "\[backend_server\]" debug.log > backend-server-debug.log
  ```

- Generated `*.log` files MUST remain untracked and MUST NOT be included in
  commits or release archives.

## 6. Code Changes and Git

- Preserve existing structure and formatting unless the requested change is a
  refactor.
- Keep commits focused and use Conventional Commits when creating commits.
- Do not amend or rewrite existing commits unless explicitly requested.
- Review `git diff`, `git diff --check`, and the final status before handoff.
- Do not include generated build output, local configuration, test reports, or
  log files in commits.

## 7. Code Organization and File Size

- Every source file over 1,000 lines MUST trigger an explicit design review
  before more responsibilities are added. Evaluate cohesion, dependency
  direction, state ownership, and whether behavior can move to focused modules.
- Do not allow a file to cross the 1,000-line threshold without recording the
  assessment in the change summary or commit body.
- When modifying an existing file that already exceeds 1,000 lines, avoid
  increasing its scope. Split a clear boundary during the change when safe; if
  an immediate split is riskier, document the reason and intended module.
- New modules MUST have one clear responsibility. Keep `server.ts`, `app.ts`,
  build entry points, and route coordinators thin.
- Prefer Prettier-standard JavaScript and TypeScript, explicit type-only
  imports, typed error handling, and async error propagation.
- Do not add emojis or unnecessary comments to source, documentation, or commit
  messages.

## 8. Documentation and Dependencies

- Keep dependencies in the package that uses them. Remove unused dependencies
  when a refactor makes them obsolete.
- Keep detailed design decisions, migration notes, release notes, historical
  investigations, and manual test procedures in dedicated English documents
  under `docs/`.
- Do not recreate removed legacy documents or maintain stale checklists of
  completed work.

## 9. Documentation and Task Tracking

- `README.md` contains the product overview, supported scope, configuration,
  and developer entry points.
- Documentation MUST describe actual behavior. Clearly label planned behavior,
  unsupported input, experimental features, and platform-specific limitations.
- Remove completed pending entries from planning documents when a task is done.

## Common Commands

```bash
pnpm install:all
pnpm dev
pnpm dev:backend
pnpm dev:frontend
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format
```

Local runtime configuration belongs in the ignored `config.yaml`; use
`config.yaml.example` as the committed template. Production builds are
generated in `dist/` and run with `node server.js` from that directory.
