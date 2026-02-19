const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

fs.removeSync(r("dist"));

try {
    fs.removeSync(r("simple-server"));
}
catch {}

try {
    fs.removeSync(r("simple-server.exe"));
}
catch {}

fs.removeSync(r("public/markdown-viewer"));

fs.removeSync(r("public/styles.css"));

fs.removeSync(r("src/frontend/markdown-viewer/markdown-viewer"));