/**
 * Copies shared/ JS files into src/shared/ before build.
 * Run from any app subdirectory: node ../copy-shared.js
 */
const fs = require("fs");
const path = require("path");

const sharedSrc = path.join(__dirname, "shared");
const appDir = process.cwd();
const sharedDst = path.join(appDir, "src", "shared");

fs.mkdirSync(sharedDst, { recursive: true });

const files = fs.readdirSync(sharedSrc).filter(f => f.endsWith(".js"));
files.forEach(f => {
  fs.copyFileSync(path.join(sharedSrc, f), path.join(sharedDst, f));
  console.log(`copied shared/${f}`);
});
