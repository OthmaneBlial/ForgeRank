import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

export class GitInspectionError extends Error {
  override name = "GitInspectionError";
}

export async function runGit(
  args: string[],
  options?: { timeoutMs?: number; maxBufferBytes?: number },
): Promise<string> {
  if (args.some((argument) => argument.includes("\0")))
    throw new GitInspectionError("Git arguments may not contain null bytes.");
  try {
    const result = await executeFile("git", args, {
      timeout: options?.timeoutMs ?? 60_000,
      maxBuffer: options?.maxBufferBytes ?? 8 * 1024 * 1024,
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
      windowsHide: true,
    });
    return result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Git failure";
    throw new GitInspectionError(message.slice(0, 1_000));
  }
}

export async function runGitLines(
  args: string[],
  maxLines = 30_000,
  timeoutMs = 60_000,
): Promise<{ lines: string[]; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const processHandle = spawn("git", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
    });
    const lines: string[] = [];
    let remainder = "";
    let stderr = "";
    let truncated = false;
    const timeout = setTimeout(() => processHandle.kill("SIGTERM"), timeoutMs);
    processHandle.stdout.setEncoding("utf8");
    processHandle.stderr.setEncoding("utf8");
    processHandle.stdout.on("data", (chunk: string) => {
      const parts = `${remainder}${chunk}`.split("\n");
      remainder = parts.pop() ?? "";
      for (const line of parts) {
        if (lines.length >= maxLines) {
          truncated = true;
          processHandle.kill("SIGTERM");
          break;
        }
        lines.push(line);
      }
    });
    processHandle.stderr.on("data", (chunk: string) => {
      if (stderr.length < 2_000) stderr += chunk;
    });
    processHandle.on("error", (error) => {
      clearTimeout(timeout);
      reject(new GitInspectionError(error.message));
    });
    processHandle.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (remainder && lines.length < maxLines) lines.push(remainder);
      if (code === 0 || (truncated && signal === "SIGTERM")) resolve({ lines, truncated });
      else
        reject(
          new GitInspectionError(`git exited ${code ?? signal}: ${stderr.trim().slice(0, 1_000)}`),
        );
    });
  });
}
