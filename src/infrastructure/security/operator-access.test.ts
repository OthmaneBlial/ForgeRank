import { describe, expect, it } from "vitest";

import { resolveOperatorAccess } from "@/infrastructure/security/operator-access";

const productionCredentials = {
  nodeEnv: "production",
  adminEnabled: "1",
  adminUsername: "operator",
  adminPassword: "correct-horse-battery-staple",
};

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("operator access policy", () => {
  it("allows an explicitly enabled loopback-only development dashboard", () => {
    expect(
      resolveOperatorAccess({
        nodeEnv: "development",
        host: "127.0.0.1:3000",
        localAdminEnabled: "1",
      }),
    ).toBe("allowed");
    expect(
      resolveOperatorAccess({
        nodeEnv: "test",
        host: "[::1]:3000",
        localAdminEnabled: "1",
      }),
    ).toBe("allowed");
  });

  it("does not treat a hostname prefix as loopback", () => {
    expect(
      resolveOperatorAccess({
        nodeEnv: "development",
        host: "localhost.attacker.example",
        localAdminEnabled: "1",
      }),
    ).toBe("disabled");
  });

  it("never applies the local bypass in production", () => {
    expect(
      resolveOperatorAccess({
        nodeEnv: "production",
        host: "localhost:3000",
        localAdminEnabled: "1",
      }),
    ).toBe("disabled");
  });

  it("fails closed when production operator access is disabled", () => {
    expect(resolveOperatorAccess({ nodeEnv: "production" })).toBe("disabled");
  });

  it("reports an enabled but incomplete credential configuration", () => {
    expect(
      resolveOperatorAccess({
        nodeEnv: "production",
        adminEnabled: "1",
        adminUsername: "operator",
        adminPassword: "too-short",
      }),
    ).toBe("misconfigured");
  });

  it("challenges missing and malformed credentials", () => {
    expect(resolveOperatorAccess(productionCredentials)).toBe("challenge");
    expect(resolveOperatorAccess({ ...productionCredentials, authorization: "Bearer no" })).toBe(
      "challenge",
    );
    expect(resolveOperatorAccess({ ...productionCredentials, authorization: "Basic !!!" })).toBe(
      "challenge",
    );
  });

  it("challenges either incorrect credential without accepting prefix matches", () => {
    expect(
      resolveOperatorAccess({
        ...productionCredentials,
        authorization: basic("operator", "correct-horse-battery-stapler"),
      }),
    ).toBe("challenge");
    expect(
      resolveOperatorAccess({
        ...productionCredentials,
        authorization: basic("operator-extra", "correct-horse-battery-staple"),
      }),
    ).toBe("challenge");
  });

  it("accepts only the exact configured credentials", () => {
    expect(
      resolveOperatorAccess({
        ...productionCredentials,
        authorization: basic("operator", "correct-horse-battery-staple"),
      }),
    ).toBe("allowed");
  });
});
