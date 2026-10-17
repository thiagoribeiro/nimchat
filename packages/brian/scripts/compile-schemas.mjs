import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import standalone from "ajv/dist/standalone/index.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "schemas");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function expand(schema, file) {
  if (Array.isArray(schema)) return schema.map((x) => expand(x, file));
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    const p = path.resolve(path.dirname(file), schema.$ref);
    return expand(read(p), p);
  }
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([k]) => k !== "$id")
      .map(([k, v]) => [k, expand(v, file)]),
  );
}
const ajv = new Ajv2020({
  strict: false,
  allErrors: false,
  code: { source: true, esm: true },
});
const exports = {};
for (const group of ["core", "plugins", "events"]) {
  for (const file of fs
    .readdirSync(path.join(src, group))
    .filter((x) => x.endsWith(".json"))) {
    const name =
      group + "_" + file.replace("-1.0.json", "").replaceAll("-", "_");
    const p = path.join(src, group, file);
    ajv.addSchema(expand(read(p), p), name);
    exports[name] = name;
  }
}
const code = standalone(ajv, exports).replaceAll(
  'require("ajv/dist/runtime/ucs2length").default',
  "codePointLength",
);
fs.writeFileSync(
  path.join(root, "src/validators.js"),
  "// Generated; validators are compiled ahead of time for Hermes.\nfunction codePointLength(str){return Array.from(str).length;}\n" +
    code,
);
fs.writeFileSync(
  path.join(root, "src/validators.d.ts"),
  Object.keys(exports)
    .map((n) => `export const ${n}: (data: unknown) => boolean;`)
    .join("\n") + "\n",
);

fs.writeFileSync(
  path.join(root, "src/catalog.js"),
  "// Generated from the versioned BRIAN catalog.\nexport default " +
    JSON.stringify(read(path.join(root, "src/catalog.json"))) +
    ";\n",
);
