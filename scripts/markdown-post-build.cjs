const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

fs.renameSync(r("src/frontend/markdown-viewer/dist"), r("src/frontend/markdown-viewer/markdown-viewer"));
fs.moveSync(r("src/frontend/markdown-viewer/markdown-viewer"), r("public/markdown-viewer"));