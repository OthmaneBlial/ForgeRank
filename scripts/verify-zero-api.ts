import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["src", "package.json", "pnpm-lock.yaml"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yaml", ".yml"]);
const disallowed = [
  ["api", "github", "com"].join("."),
  ["GITHUB", "TOKEN"].join("_"),
  ["GITHUB", "CLIENT", "ID"].join("_"),
  ["GITHUB", "CLIENT", "SECRET"].join("_"),
  ["@", "octokit"].join(""),
  ["Authorization", "Bearer"].join(":"),
];

async function filesAt(relative: string): Promise<string[]> {
  const target = path.join(root, relative);
  if (path.extname(target)) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !["__fixtures__", "node_modules", ".next"].includes(entry.name))
      .map((entry) => filesAt(path.join(relative, entry.name))),
  );
  return nested.flat();
}

async function main(): Promise<void> {
  const files = (await Promise.all(sourceRoots.map(filesAt)))
    .flat()
    .filter((file) => textExtensions.has(path.extname(file)));
  const violations: string[] = [];
  for (const file of files) {
    if (file.endsWith("verify-zero-api.ts")) continue;
    const content = await readFile(file, "utf8");
    for (const pattern of disallowed)
      if (content.toLowerCase().includes(pattern.toLowerCase()))
        violations.push(
          `${path.relative(root, file)} contains prohibited runtime pattern ${pattern}`,
        );
  }

  if (violations.length > 0) {
    process.stderr.write(`${violations.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Zero-API architecture guard passed across ${files.length} runtime and dependency files.\n`,
    );
  }
}

await main();
