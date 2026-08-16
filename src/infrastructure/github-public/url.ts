import { z } from "zod";

const segment = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

export type GitHubRepositoryIdentifier = {
  owner: string;
  name: string;
  fullName: string;
  sourceUrl: string;
};

export class UnsupportedRepositoryUrlError extends Error {
  override name = "UnsupportedRepositoryUrlError";
}

export function parseGitHubRepositoryInput(input: string): GitHubRepositoryIdentifier {
  const value = input.trim();
  let owner: string;
  let name: string;

  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new UnsupportedRepositoryUrlError("Enter a valid GitHub repository URL.");
    }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      throw new UnsupportedRepositoryUrlError(
        "Only public https://github.com repositories are supported.",
      );
    }
    if (url.username || url.password || url.port) {
      throw new UnsupportedRepositoryUrlError("Credentials and custom ports are not allowed.");
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      throw new UnsupportedRepositoryUrlError(
        "Use a repository root URL such as https://github.com/owner/repo.",
      );
    }
    [owner = "", name = ""] = parts;
  } else {
    const parts = value.split("/").filter(Boolean);
    if (parts.length !== 2) {
      throw new UnsupportedRepositoryUrlError("Use owner/repository or its public GitHub URL.");
    }
    [owner = "", name = ""] = parts;
  }

  name = name.replace(/\.git$/i, "");
  if (
    !segment.test(owner) ||
    !segment.test(name) ||
    owner.startsWith("-") ||
    name.startsWith("-")
  ) {
    throw new UnsupportedRepositoryUrlError("The repository owner or name is not valid.");
  }

  const parsed = z
    .object({ owner: z.string().min(1).max(100), name: z.string().min(1).max(100) })
    .parse({ owner, name });
  return {
    ...parsed,
    fullName: `${parsed.owner}/${parsed.name}`,
    sourceUrl: `https://github.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`,
  };
}
