default: dev

dev:
	cd src/backend && pnpm tsx watch server.ts

build:
	uv run build.py