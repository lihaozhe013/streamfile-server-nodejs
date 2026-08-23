default: dev

format:
	pnpm prettier --write .

dev:
	pnpm dev

dev-frontend:
	pnpm dev:frontend

dev-backend:
	pnpm dev:backend

build:
	uv run build.py
