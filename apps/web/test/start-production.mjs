import { cp, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const server = join(root, ".next/standalone/apps/web/server.js");
await access(server);
const target = dirname(server);
await cp(join(root, ".next/static"), join(target, ".next/static"), { recursive: true });
try { await access(join(root, "public")); await cp(join(root, "public"), join(target, "public"), { recursive: true }); }
catch (error) { if (error.code !== "ENOENT") throw error; }
// Exercise the same traced server and asset layout as the Docker deployment.
const child = spawn(process.execPath, [server], {
  env: { ...process.env, NODE_ENV: "production", PORT: "3106", HOSTNAME: "127.0.0.1" }, stdio: "inherit",
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
