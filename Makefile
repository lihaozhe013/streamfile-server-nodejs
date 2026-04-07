default: dev

format:
	pnpm prettier --write .

dev:
	cd src/backend && pnpm tsx watch server.ts

build:
	uv run build.py