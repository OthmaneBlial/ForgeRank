import { getRepository } from "@/infrastructure/db/repository-store";

export const dynamic = "force-dynamic";

const xml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  let repository = null;
  try {
    repository = await getRepository(owner, repo);
  } catch {
    /* database unavailable */
  }
  const value =
    repository?.score === null || repository?.score === undefined
      ? "unavailable"
      : String(Math.round(repository.score));
  const label = "ForgeRank";
  const leftWidth = 86;
  const rightWidth = Math.max(68, value.length * 8 + 26);
  const width = leftWidth + rightWidth;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${xml(value)}"><title>${label}: ${xml(value)}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".12"/></linearGradient><clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath><g clip-path="url(#r)"><rect width="${leftWidth}" height="20" fill="#24251f"/><rect x="${leftWidth}" width="${rightWidth}" height="20" fill="#e75825"/><rect width="${width}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Arial,sans-serif" font-size="11"><text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".25">${label}</text><text x="${leftWidth / 2}" y="14">${label}</text><text x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".25">${xml(value)}</text><text x="${leftWidth + rightWidth / 2}" y="14">${xml(value)}</text></g></svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
