const { cpSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  cpSync(path.join(__dirname, "..", "server"), path.join(context.appOutDir, "resources", "server"), {
    recursive: true,
  });
};
