import { createHash, timingSafeEqual } from "node:crypto";

const MINIMUM_ADMIN_PASSWORD_LENGTH = 20;

export type OperatorAccessDecision = "allowed" | "disabled" | "misconfigured" | "challenge";

export interface OperatorAccessInput {
  nodeEnv?: string;
  host?: string | null;
  authorization?: string | null;
  localAdminEnabled?: string;
  adminEnabled?: string;
  adminUsername?: string;
  adminPassword?: string;
}

interface BasicCredentials {
  username: string;
  password: string;
}

function isLoopbackHost(host: string | null | undefined): boolean {
  const normalized = host?.trim().toLowerCase() ?? "";
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "[::1]" ||
    normalized.startsWith("[::1]:")
  );
}

function parseBasicCredentials(authorization: string | null | undefined): BasicCredentials | null {
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization?.trim() ?? "");
  if (!match?.[1]) return null;

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function resolveOperatorAccess(input: OperatorAccessInput): OperatorAccessDecision {
  const localBypassAllowed =
    input.nodeEnv !== "production" && input.localAdminEnabled === "1" && isLoopbackHost(input.host);
  if (localBypassAllowed) return "allowed";

  if (input.adminEnabled !== "1") return "disabled";

  const configuredUsername = input.adminUsername ?? "";
  const configuredPassword = input.adminPassword ?? "";
  if (
    configuredUsername.trim().length === 0 ||
    configuredPassword.length < MINIMUM_ADMIN_PASSWORD_LENGTH
  ) {
    return "misconfigured";
  }

  const supplied = parseBasicCredentials(input.authorization);
  if (!supplied) return "challenge";

  const usernameMatches = constantTimeEqual(supplied.username, configuredUsername);
  const passwordMatches = constantTimeEqual(supplied.password, configuredPassword);
  return usernameMatches && passwordMatches ? "allowed" : "challenge";
}

export function resolveOperatorAccessFromEnvironment(
  requestHeaders: Pick<Headers, "get">,
  environment: NodeJS.ProcessEnv = process.env,
): OperatorAccessDecision {
  return resolveOperatorAccess({
    nodeEnv: environment.NODE_ENV,
    host: requestHeaders.get("host"),
    authorization: requestHeaders.get("authorization"),
    localAdminEnabled: environment.FORGERANK_ENABLE_LOCAL_ADMIN,
    adminEnabled: environment.FORGERANK_ENABLE_ADMIN,
    adminUsername: environment.FORGERANK_ADMIN_USERNAME,
    adminPassword: environment.FORGERANK_ADMIN_PASSWORD,
  });
}
