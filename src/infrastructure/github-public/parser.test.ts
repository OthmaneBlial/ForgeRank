import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseHumanCount, parseRepositoryHtml, RepositoryParserError } from "./parser";
import { parseGitHubRepositoryInput } from "./url";

describe("public repository HTML parser", () => {
  it("extracts and validates representative public metadata", async () => {
    const html = await readFile(
      path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/repository.html"),
      "utf8",
    );
    const observedAt = new Date("2026-08-15T12:00:00Z");
    const result = parseRepositoryHtml(
      html,
      parseGitHubRepositoryInput("forge/example"),
      observedAt,
    );

    expect(result).toMatchObject({
      fullName: "forge/example",
      description: "A fast, careful example repository for parser fixture tests.",
      primaryLanguage: "Rust",
      stars: 12_400,
      forks: 862,
      defaultBranch: "main",
      license: "LICENSE",
      isFork: false,
      confidence: "HIGH",
      parserVersion: "github-repository-parser-v2",
    });
  });

  it.each([
    ["1,284", 1284],
    ["12.4k", 12_400],
    ["1.2M", 1_200_000],
    ["not a count", null],
    ["-50", null],
  ])("parses %s without fake precision", (input, expected) => {
    expect(parseHumanCount(input)).toBe(expected);
  });

  it("rejects a document for a different repository", async () => {
    const html = await readFile(
      path.join(process.cwd(), "src/infrastructure/github-public/__fixtures__/repository.html"),
      "utf8",
    );
    expect(() => parseRepositoryHtml(html, parseGitHubRepositoryInput("other/project"))).toThrow(
      RepositoryParserError,
    );
  });

  it("rejects incomplete response bodies", () => {
    expect(() =>
      parseRepositoryHtml("<html></html>", parseGitHubRepositoryInput("forge/example")),
    ).toThrow("complete HTML document");
  });
});
