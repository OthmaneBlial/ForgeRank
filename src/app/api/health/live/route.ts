const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export function GET(): Response {
  return Response.json({ status: "ok" }, { headers });
}
