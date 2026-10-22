import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
test("native package and Package Control entry target the standalone organization repository", async () => {
  execFileSync(process.execPath, ["scripts/package.mjs"], { cwd: root, stdio: "pipe" });
  const entry = JSON.parse(await readFile(new URL("../dist/package-control.json", import.meta.url)));
  assert.deepEqual(entry, { name: "Living Code", details: "https://github.com/living-code-theme/sublime", labels: ["color scheme"], releases: [{ sublime_text: ">=4000", tags: true }] });
  const files = JSON.parse(execFileSync("python3", ["-c", "import zipfile,json; z=zipfile.ZipFile('dist/Living Code.sublime-package'); assert z.testzip() is None; print(json.dumps(z.namelist()))"], { cwd: root, encoding: "utf8" }));
  assert.deepEqual(files.sort(), ["LICENSE", ...["night", "frost", "paper", "signal"].map(f => `living-code-${f}.sublime-color-scheme`)].sort());
});
