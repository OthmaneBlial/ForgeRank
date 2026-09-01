import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const invocationRoot = process.cwd();

export async function runForgeRank(entrypoint) {
  process.env.FORGERANK_DATA_DIR ??= path.join(invocationRoot, ".forgerank");
  process.env.FORGERANK_DISTRIBUTION = "npm";

  process.chdir(packageRoot);
  await import(new URL(entrypoint, new URL("../", import.meta.url)));
}
