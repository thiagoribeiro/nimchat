import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit build inputs: Expo embeds these values in the Hermes bundle.
// Missing trust configuration produces fallback-only cards, so fail early.
if (!process.env.EXPO_PUBLIC_NIMLET_URL?.trim()) {
  console.error("Set EXPO_PUBLIC_NIMLET_URL to your Nimlet server before a release build.");
  process.exit(1);
}
for (const name of ["EXPO_PUBLIC_BRIAN_AGENT_IDS", "EXPO_PUBLIC_BRIAN_PUBLISHER_IDS"]) {
  if (!process.env[name]?.split(",").some((id) => id.trim())) {
    console.error(`Set ${name} to the real public user IDs before a release build.`);
    process.exit(1);
  }
}
const result = spawnSync("./gradlew", [
  // Gradle does not track Expo public env changes as bundle inputs.
  // Force only the JS task to avoid reusing a bundle with old identities.
  ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease",
  "-PreactNativeArchitectures=arm64-v8a", "--max-workers=2", "--console=plain",
], { cwd: fileURLToPath(new URL("../android", import.meta.url)), stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
