default: dev

format:
	pnpm prettier --write .

dev:
	cd src/backend && pnpm tsx watch server.ts

dev-frontend:
	cd src/frontend/app && pnpm dev

build:
	uv run build.py
