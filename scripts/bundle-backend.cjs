const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/backend/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2024',
  outdir: 'dist',
  sourcemap: false,
  minify: true,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
  }
}


build().catch((err) => {
  console.error(err);
  process.exit(1);
});
