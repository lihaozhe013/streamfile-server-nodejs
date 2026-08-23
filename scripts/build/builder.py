from scripts.build.directory_manager import DirectoryManager


def build(base_dir):
    frontend_dir = base_dir / 'src' / 'frontend'
    backend_dir = base_dir / 'src' / 'backend'
    frontend_app_dir = frontend_dir / 'app'
    public_dir = base_dir / 'src' / 'frontend' / "public"
    dist_dir = base_dir / "dist"

    clean_list = [
        dist_dir,
        public_dir / 'assets',
    ]

    builder = DirectoryManager()

    # clean old distributions
    builder.clean(clean_list)
    builder.delete(public_dir / 'index.html')
    builder.delete(public_dir / 'styles.css')

    # type-check backend before bundling
    builder.run(backend_dir, 'pnpm tsc --noEmit')

    # build backend
    builder.run(base_dir, 'node src/backend/build/bundle-backend.cjs')
    
    # build frontend
    builder.run(frontend_app_dir, 'pnpm typecheck && pnpm vite build')

    # post build
    builder.copy(public_dir, dist_dir / 'public')
