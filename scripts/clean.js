const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

try {
    fs.rmSync(r("simple-server"));
}
catch {}

try {
    fs.rmSync(r("simple-server.exe"));
}
catch {}

try {
    fs.rmSync(r("public/markdown-viewer"), { recursive: true });
}
catch {}

try {
    fs.rmSync(r("public/styles.css"));
}
catch {}

