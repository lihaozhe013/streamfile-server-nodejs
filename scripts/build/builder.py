from scripts.build.directory_manager import DirectoryManager


def build(base_dir):
    frontend_dir = base_dir / 'src' / 'frontend'
    backend_dir = base_dir / 'src' / 'backend'
    frontend_app_dir = frontend_dir / 'app'
    dist_dir = base_dir / "dist"

    clean_list = [dist_dir / 'public']

    builder = DirectoryManager()

    # clean old distributions
    builder.clean(clean_list)
    builder.delete(dist_dir / 'server.js')
    builder.delete(dist_dir / 'default.yaml')

    # type-check backend before bundling
    builder.run(backend_dir, 'pnpm typecheck')

    # build backend
    builder.run(backend_dir, 'pnpm build')
    
    # build frontend
    builder.run(frontend_app_dir, 'pnpm typecheck && pnpm vite build')

    # verify the self-contained build output without touching runtime-owned files
    for required_file in [
        dist_dir / 'server.js',
        dist_dir / 'default.yaml',
        dist_dir / 'public' / 'index.html',
        dist_dir / 'public' / '404-index.html',
    ]:
        builder.check_exists(required_file)
