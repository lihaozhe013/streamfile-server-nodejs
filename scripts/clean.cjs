const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

try {
    fs.removeSync(r("dist"));
}
catch {}

try {
    fs.removeSync(r("simple-server"));
}
catch {}

try {
    fs.removeSync(r("simple-server.exe"));
}
catch {}

try {
    fs.removeSync(r("public/markdown-viewer"));
}
catch {}

try {
    fs.removeSync(r("public/styles.css"));
}
catch{}

try {
    fs.removeSync(r("src/frontend/markdown-viewer/markdown-viewer"));
}
catch {}