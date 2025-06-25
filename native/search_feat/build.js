const fs = require('fs');
const path = require('path');

// Get the current directory (native/search_feat)
const currentDir = __dirname;
const distDir = path.join(currentDir, '../../dist/');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Find the first .node file in the current directory
const nodeFile = fs.readdirSync(currentDir).find(file => file.endsWith('.node'));
if (nodeFile) {
  const sourcePath = path.join(currentDir, nodeFile);
  const destPath = path.join(distDir, 'search_feat.node');
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied and renamed ${nodeFile} to search_feat.node in dist/`);
} else {
  console.warn('No .node file found in the current directory.');
}

// Copy and rename index.js if it exists
const indexJsPath = path.join(currentDir, 'index.js');
if (fs.existsSync(indexJsPath)) {
  const destPath = path.join(distDir, 'index.js');
  fs.copyFileSync(indexJsPath, destPath);
  console.log('Copied index.js to dist/');
}

console.log('Build script completed successfully!'); 