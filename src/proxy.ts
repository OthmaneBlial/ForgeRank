import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveOperatorAccessFromEnvironment } from "@/infrastructure/security/operator-access";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function proxy(request: NextRequest): NextResponse {
  const decision = resolveOperatorAccessFromEnvironment(request.headers);

  if (decision === "allowed") {
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  }

  if (decision === "challenge") {
    return new NextResponse("Operator authentication required.", {
      status: 401,
      headers: {
        ...privateHeaders,
        "WWW-Authenticate": 'Basic realm="ForgeRank operator", charset="UTF-8"',
      },
    });
  }

  if (decision === "misconfigured") {
    return new NextResponse("Operator access is not configured safely.", {
      status: 503,
      headers: privateHeaders,
    });
  }

  return new NextResponse("Not found.", { status: 404, headers: privateHeaders });
}

export const config = {
  matcher: "/admin/:path*",
};
