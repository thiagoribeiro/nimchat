import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Builds the web app (same env checks as a Docker release) and lays out the standalone
// server the way the Dockerfile's runner stage does: .next/static is not traced into
// .next/standalone, so it has to be copied in next to server.js.
const web = fileURLToPath(new URL("../../web/", import.meta.url));
const out = fileURLToPath(new URL("../server/", import.meta.url));

if (process.env.SKIP_WEB_BUILD !== "1") {
  const result = spawnSync("npm", ["run", "build:release"], { cwd: web, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(`${web}.next/standalone/apps/web/server.js`)) {
  console.error("apps/web/.next/standalone is missing — run the web release build first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(`${web}.next/standalone`, out, { recursive: true });
cpSync(`${web}.next/static`, `${out}apps/web/.next/static`, { recursive: true });
if (existsSync(`${web}public`)) cpSync(`${web}public`, `${out}apps/web/public`, { recursive: true });
console.log(`Standalone server ready in ${out}`);
