const fs = require("fs-extra");
const path = require("path");
const root = path.resolve(__dirname, "..");
const r = (...p) => path.resolve(root, ...p);

fs.ensureDirSync(r("dist"));
fs.copySync(r("public"), r("dist/public"))