const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

try {
    fs.rmSync(r("dist"), { recursive: true });
}
catch {}

fs.ensureDirSync(r("dist"));
fs.copySync(r("public"), r("dist/public"))
fs.copySync(r("config.yaml.example"), r("dist/config.yaml.example"))
try {
    fs.copySync(r("config.yaml"), r("dist/config.yaml"))
}
catch {}

try {
    fs.copySync(r("simple-server"), r("dist/simple-server"))
}
catch {}

try {
    fs.copySync(r("simple-server.exe"), r("dist/simple-server.exe"))
}
catch {}