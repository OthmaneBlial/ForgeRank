import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDeveloperHtml } from "./developer-parser";

const identity = { username: "sharkdp", sourceUrl: "https://github.com/sharkdp" };

describe("public developer profile parser", () => {
  it("extracts a public user profile without private identifiers", async () => {
    const html = await readFile(
      path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/profile.html"),
      "utf8",
    );
    const result = parseDeveloperHtml(html, identity, new Date("2026-08-15T12:00:00Z"));

    expect(result).toMatchObject({
      username: "sharkdp",
      displayName: "David Peter",
      bio: "Creator of bat and fd. Open-source developer.",
      location: "Germany",
      avatarUrl: "https://avatars.githubusercontent.com/u/4209276?v=4",
      confidence: "HIGH",
      parserVersion: "github-profile-parser-v1",
    });
  });

  it("rejects a page for a different account", async () => {
    const html = await readFile(
      path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/profile.html"),
      "utf8",
    );
    expect(() => parseDeveloperHtml(html, { ...identity, username: "someone-else" })).toThrow(
      "identifies sharkdp",
    );
  });

  it("rejects organization pages", async () => {
    const html = (
      await readFile(
        path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/profile.html"),
        "utf8",
      )
    ).replace('content="User"', 'content="Organization"');
    expect(() => parseDeveloperHtml(html, identity)).toThrow("not organizations");
  });

  it("ignores unsafe avatar hosts", async () => {
    const html = (
      await readFile(
        path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/profile.html"),
        "utf8",
      )
    ).replace(
      "https://avatars.githubusercontent.com/u/4209276?v=4",
      "https://example.com/avatar.png",
    );
    expect(parseDeveloperHtml(html, identity).avatarUrl).toBeNull();
  });
});
