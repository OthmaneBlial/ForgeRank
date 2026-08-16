import { describe, expect, it } from "vitest";

import { encodeCsv } from "./repository-export";

describe("repository CSV export", () => {
  it("quotes delimiters and protects spreadsheet formulas", () => {
    expect(
      encodeCsv([
        {
          name: "owner/repo",
          description: "fast, careful",
          note: "=1+1",
          score: 72,
          missing: null,
        },
      ]),
    ).toBe('name,description,note,score,missing\nowner/repo,"fast, careful",\'=1+1,72,\n');
  });

  it("emits stable ISO timestamps", () => {
    expect(encodeCsv([{ observedAt: new Date("2026-08-15T12:00:00Z") }])).toContain(
      "2026-08-15T12:00:00.000Z",
    );
  });
});
