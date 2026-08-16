import { describe, expect, it } from "vitest";

import { parseGitHubRepositoryInput, UnsupportedRepositoryUrlError } from "./url";

describe("GitHub repository input validation", () => {
  it.each([
    ["facebook/react", "facebook/react"],
    ["https://github.com/rust-lang/rust", "rust-lang/rust"],
    ["https://github.com/owner/repo.git", "owner/repo"],
  ])("accepts %s", (input, fullName) => {
    expect(parseGitHubRepositoryInput(input).fullName).toBe(fullName);
  });

  it.each([
    "http://github.com/owner/repo",
    "https://example.com/owner/repo",
    "https://user:secret@github.com/owner/repo",
    "https://github.com:8443/owner/repo",
    "https://github.com/owner/repo/issues",
    "--upload-pack=malicious/repo",
    "owner",
  ])("rejects unsafe or non-root input %s", (input) => {
    expect(() => parseGitHubRepositoryInput(input)).toThrow(UnsupportedRepositoryUrlError);
  });
});
