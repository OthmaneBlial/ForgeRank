import { z } from "zod";

const usernamePattern = /^(?!-)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function parseGitHubUsername(input: string): { username: string; sourceUrl: string } {
  const value = input.trim();
  let username = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Only public https://github.com profile URLs are supported.");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) throw new Error("Use a public profile root URL.");
    username = parts[0] ?? "";
  }
  return z
    .object({ username: z.string().regex(usernamePattern) })
    .transform(({ username }) => ({
      username,
      sourceUrl: `https://github.com/${encodeURIComponent(username)}`,
    }))
    .parse({ username });
}
