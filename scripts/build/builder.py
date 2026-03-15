from scripts.build.directory_manager import DirectoryManager


def build(base_dir):
    frontend_dir = base_dir / 'src' / 'frontend'
    backend_dir = base_dir / 'src' / 'backend'
    markdown_viewer_dir = frontend_dir / 'markdown-viewer'
    public_dir = base_dir / 'src' / 'frontend' / "public"
    dist_dir = base_dir / "dist"

    clean_list = [
        dist_dir,
        public_dir / 'markdown-viewer',
        public_dir / 'styles.css'
    ]

    builder = DirectoryManager()

    # clean old distributions
    builder.clean(clean_list)

    # build backend
    builder.run(base_dir, 'node src/backend/build/bundle-backend.cjs')
    
    # build frontend
    builder.run(markdown_viewer_dir, 'npx tsc && npx vite build')
    builder.move(markdown_viewer_dir / 'dist', public_dir / 'markdown-viewer')

    # build css
    builder.run(base_dir, 'npx postcss ./src/input.css -o ./src/frontend/public/styles.css')

    # post build
    builder.copy(public_dir, dist_dir / 'public')