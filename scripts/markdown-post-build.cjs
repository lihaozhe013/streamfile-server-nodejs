const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

try {
    fs.removeSync(r("src/frontend/markdown-viewer/markdown-viewer"));
}
catch {}

fs.renameSync(r("src/frontend/markdown-viewer/dist"), r("src/frontend/markdown-viewer/markdown-viewer"));
try {
    fs.removeSync(r("public/markdown-viewer"));
    console.log("Removed old markdown-viewer");
}
catch {}

fs.moveSync(r("src/frontend/markdown-viewer/markdown-viewer"), r("public/markdown-viewer"), { overwrite: true });
console.log("Build markdown-viewer successfully");