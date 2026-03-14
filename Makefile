default: dev

dev:
	cd src/backend && npx tsx watch server.ts

build:
	uv run build.py