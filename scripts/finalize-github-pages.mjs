import { copyFile, writeFile } from "node:fs/promises";

// docs/ is generated exclusively for GitHub Pages; keep source documentation elsewhere.
const output = new URL("../docs/", import.meta.url);
await writeFile(new URL(".nojekyll", output), "");
await copyFile(new URL("index.html", output), new URL("404.html", output));
console.log("GitHub Pages export ready in docs/ (base /timevault/).");
