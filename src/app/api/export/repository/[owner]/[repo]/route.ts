import { getRepositoryDetailReadModel } from "@/application/read-model";
import { encodeCsv } from "@/domain/export/repository-export";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ owner: string; repo: string }>;

export async function GET(request: Request, { params }: { params: RouteParams }) {
  const { owner, repo } = await params;
  const model = await getRepositoryDetailReadModel(owner, repo);
  if (!model) return Response.json({ error: "Repository is not indexed." }, { status: 404 });

  const { repository, snapshots, gitAnalysis, repositoryEvents } = model;
  const filename = `${repository.owner}-${repository.name}-forgerank`;
  const format = new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "json";

  if (format === "csv") {
    const body = encodeCsv(
      snapshots.map((snapshot) => ({
        repository: repository.fullName,
        observedAt: snapshot.observedAt,
        stars: snapshot.stars,
        forks: snapshot.forks,
        forgeScore: snapshot.forgeScore,
        impactScore: snapshot.impactScore,
        momentumScore: snapshot.momentumScore,
        healthScore: snapshot.healthScore,
        communityScore: snapshot.communityScore,
        engineeringScore: snapshot.engineeringScore,
        trustScore: snapshot.trustScore,
        confidence: snapshot.confidence,
        parserVersion: snapshot.parserVersion,
        scoreVersion: snapshot.scoreVersion,
      })),
    );
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (format !== "json")
    return Response.json({ error: "Supported formats are json and csv." }, { status: 400 });

  const body = {
    schemaVersion: "forgerank-repository-export-v2",
    scope: "ForgeRank indexed universe",
    repository: {
      fullName: repository.fullName,
      description: repository.description,
      sourceUrl: `https://github.com/${repository.fullName}`,
      primaryLanguage: repository.primaryLanguage,
      license: repository.license,
      state: repository.state,
      maturity: repository.maturity,
      stars: repository.stars,
      forks: repository.forks,
      score: repository.score,
      scoreConfidence: repository.scoreConfidence,
      momentum: repository.momentum,
      rank: repository.rank,
      observedAt: repository.observedAt,
      lastActivityAt: repository.lastActivityAt,
    },
    gitAnalysis: gitAnalysis
      ? {
          analyzedAt: gitAnalysis.analyzedAt,
          strategy: gitAnalysis.strategy,
          commits30d: gitAnalysis.commits30d,
          commits90d: gitAnalysis.commits90d,
          activeWeeks12: gitAnalysis.activeWeeks12,
          previousDormantPeriodDays: gitAnalysis.previousDormantPeriodDays,
          uniqueAuthors90d: gitAnalysis.uniqueAuthors90d,
          topContributorShare: gitAnalysis.topContributorShare,
          topThreeContributorShare: gitAnalysis.topThreeContributorShare,
          detectedTechnologies: gitAnalysis.detectedTechnologies,
          qualitySignals: gitAnalysis.qualitySignals,
          readmeAnalysis: gitAnalysis.readmeAnalysis,
          analysisVersion: gitAnalysis.analysisVersion,
        }
      : null,
    events: repositoryEvents.map((event) => ({
      kind: event.kind,
      occurredAt: event.occurredAt,
      title: event.title,
      detail: event.detail,
      source: event.source,
      confidence: event.confidence,
      version: event.version,
    })),
    snapshots: snapshots.map((snapshot) => ({
      observedAt: snapshot.observedAt,
      stars: snapshot.stars,
      forks: snapshot.forks,
      forgeScore: snapshot.forgeScore,
      dimensions: {
        impact: snapshot.impactScore,
        momentum: snapshot.momentumScore,
        health: snapshot.healthScore,
        community: snapshot.communityScore,
        engineering: snapshot.engineeringScore,
        trust: snapshot.trustScore,
      },
      confidence: snapshot.confidence,
      parserVersion: snapshot.parserVersion,
      scoreVersion: snapshot.scoreVersion,
      provenance: snapshot.provenance,
    })),
    privacy:
      "Aggregate Git activity only. Commit emails and unconfirmed account links are excluded.",
  };
  return Response.json(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}.json"`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
