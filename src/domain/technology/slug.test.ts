import { describe, expect, it } from "vitest";

import { technologySlug } from "./slug";

describe("technology slugs", () => {
  it.each([
    ["Node.js package", "node-js-package"],
    ["GitHub Actions", "github-actions"],
    ["C++", "c"],
  ])("normalizes %s", (name, slug) => expect(technologySlug(name)).toBe(slug));
});
