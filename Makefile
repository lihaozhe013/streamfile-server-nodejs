default: dev

format:
	bun run format

dev:
	bun run dev

dev-frontend:
	bun run dev:frontend

dev-backend:
	bun run dev:backend

build:
	bun run build