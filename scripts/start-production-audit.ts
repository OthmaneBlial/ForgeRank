import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("The production audit must be started through pnpm.");
if (!process.env.DATABASE_URL) {
  process.env.FORGERANK_DATA_DIR = path.resolve(
    root,
    process.env.FORGERANK_DATA_DIR?.trim() || path.join("data", "pglite"),
  );
}

const build = spawnSync(process.execPath, [pnpmCli, "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const standaloneRoot = path.join(root, ".next", "standalone");
const standalonePublic = path.join(standaloneRoot, "public");
const standaloneStatic = path.join(standaloneRoot, ".next", "static");
await rm(standalonePublic, { recursive: true, force: true });
await rm(standaloneStatic, { recursive: true, force: true });
await mkdir(path.dirname(standaloneStatic), { recursive: true });
await cp(path.join(root, "public"), standalonePublic, { recursive: true });
await cp(path.join(root, ".next", "static"), standaloneStatic, { recursive: true });

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3211";
await import(pathToFileURL(path.join(standaloneRoot, "server.js")).href);
