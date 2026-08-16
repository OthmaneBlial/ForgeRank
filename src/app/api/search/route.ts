import { NextResponse } from "next/server";

import { searchIndex } from "@/application/read-model";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchIndex(query), {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
