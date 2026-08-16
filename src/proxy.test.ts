import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

import { config, proxy } from "@/proxy";

const username = "operator";
const password = "correct-horse-battery-staple";

function request(authorization?: string): NextRequest {
  return new NextRequest("https://forgerank.example/admin/system", {
    headers: authorization ? { authorization } : undefined,
  });
}

function basic(candidateUsername: string, candidatePassword: string): string {
  return `Basic ${Buffer.from(`${candidateUsername}:${candidatePassword}`, "utf8").toString("base64")}`;
}

function enableProductionAdmin(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("FORGERANK_ENABLE_ADMIN", "1");
  vi.stubEnv("FORGERANK_ADMIN_USERNAME", username);
  vi.stubEnv("FORGERANK_ADMIN_PASSWORD", password);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("operator proxy", () => {
  it("matches only the private admin route family", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/admin/system" })).toBe(
      true,
    );
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/repositories" })).toBe(
      false,
    );
  });

  it("hides a disabled dashboard", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FORGERANK_ENABLE_ADMIN", "0");

    const response = proxy(request());
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not found.");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed when enabled credentials are unsafe", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FORGERANK_ENABLE_ADMIN", "1");
    vi.stubEnv("FORGERANK_ADMIN_USERNAME", username);
    vi.stubEnv("FORGERANK_ADMIN_PASSWORD", "short");

    expect(proxy(request()).status).toBe(503);
  });

  it("issues a standards-based challenge for invalid credentials", () => {
    enableProductionAdmin();

    const response = proxy(request(basic(username, "incorrect-password-value")));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="ForgeRank operator", charset="UTF-8"',
    );
  });

  it("passes exact credentials without making the response cacheable", () => {
    enableProductionAdmin();

    const response = proxy(request(basic(username, password)));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});
