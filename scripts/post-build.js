const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

fs.renameSync(r("react/dist"), r("react/markdown-viewer"));
fs.moveSync(r("react/markdown-viewer"), r("public/markdown-viewer"));