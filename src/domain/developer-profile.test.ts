import { describe, expect, it } from "vitest";

import {
  applyDeveloperProfileEvents,
  validateDeveloperProfileCorrection,
} from "./developer-profile";

describe("developer profile corrections", () => {
  it("applies an auditable override and later reverts to observed source data", () => {
    const source = { displayName: "Observed", bio: "Original bio", location: "Paris", extra: true };
    const corrected = applyDeveloperProfileEvents(source, [
      {
        action: "SET_FIELD",
        field: "DISPLAY_NAME",
        value: "Corrected",
        createdAt: new Date("2026-08-01"),
      },
      { action: "HIDE_FIELD", field: "LOCATION", value: null, createdAt: new Date("2026-08-02") },
    ]);
    expect(corrected).toMatchObject({
      displayName: "Corrected",
      location: null,
      bio: "Original bio",
      extra: true,
    });
    expect(
      applyDeveloperProfileEvents(source, [
        {
          action: "SET_FIELD",
          field: "DISPLAY_NAME",
          value: "Corrected",
          createdAt: new Date("2026-08-01"),
        },
        {
          action: "REVERT_FIELD",
          field: "DISPLAY_NAME",
          value: null,
          createdAt: new Date("2026-08-03"),
        },
      ]).displayName,
    ).toBe("Observed");
  });

  it("requires explicit reasons and values for corrections", () => {
    expect(() =>
      validateDeveloperProfileCorrection({
        field: "BIO",
        action: "SET_FIELD",
        value: "",
        reason: "verified request",
      }),
    ).toThrow(/non-empty/i);
    expect(() =>
      validateDeveloperProfileCorrection({ field: "BIO", action: "HIDE_FIELD", reason: "no" }),
    ).toThrow(/audit reason/i);
  });
});
