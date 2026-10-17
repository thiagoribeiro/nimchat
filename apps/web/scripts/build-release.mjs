import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (!process.env.NEXT_PUBLIC_NIMLET_URL?.trim()) {
  console.error("Set NEXT_PUBLIC_NIMLET_URL to your Nimlet server before a release build.");
  process.exit(1);
}
for (const name of ["NEXT_PUBLIC_BRIAN_AGENT_IDS", "NEXT_PUBLIC_BRIAN_PUBLISHER_IDS"]) {
  if (!process.env[name]?.split(",").some((id) => id.trim())) {
    console.error(`Set ${name} to the real public user IDs before a release build.`);
    process.exit(1);
  }
}
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "inherit",
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
