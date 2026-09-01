import { ImageResponse } from "next/og";

import { getRepositoryDetailReadModel } from "@/application/read-model";

export const alt = "ForgeRank repository intelligence card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function RepositoryOpenGraphImage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const model = await getRepositoryDetailReadModel(owner, repo);
  const repository = model?.repository;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        color: "#181915",
        background: "#f4f0e8",
        backgroundImage:
          "linear-gradient(#d8d1c6 1px, transparent 1px), linear-gradient(90deg, #d8d1c6 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: 23,
        }}
      >
        <strong style={{ display: "flex", fontSize: 35 }}>
          Forge<span style={{ color: "#e75825" }}>Rank</span>
        </strong>
        <span style={{ padding: "10px 16px", border: "1px solid #8d887f", background: "#f4f0e8" }}>
          PUBLIC EVIDENCE · NO API CREDENTIALS
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            marginBottom: 13,
            color: "#66645e",
            fontFamily: "Arial, sans-serif",
            fontSize: 21,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {repository?.primaryLanguage ?? "Repository intelligence"}
        </span>
        <div style={{ display: "flex", fontSize: 86, lineHeight: 1 }}>
          {owner}/<strong>{repo}</strong>
        </div>
        <span
          style={{
            maxWidth: 920,
            marginTop: 23,
            color: "#53524d",
            fontFamily: "Arial, sans-serif",
            fontSize: 27,
          }}
        >
          {repository?.description ??
            "No validated public repository observation is available yet."}
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, fontFamily: "Arial, sans-serif" }}>
        <Metric
          label="FORGERANK"
          value={
            repository?.score === null || repository?.score === undefined
              ? "—"
              : Math.round(repository.score).toString()
          }
        />
        <Metric label="STARS" value={repository?.stars?.toLocaleString("en") ?? "UNAVAILABLE"} />
        <Metric label="CONFIDENCE" value={repository?.scoreConfidence ?? "INSUFFICIENT"} />
      </div>
    </div>,
    size,
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        padding: "18px 21px",
        border: "1px solid #8d887f",
        background: "#f4f0e8",
      }}
    >
      <span style={{ color: "#77736b", fontSize: 16, letterSpacing: 2 }}>{label}</span>
      <strong
        style={{ marginTop: 5, color: label === "FORGERANK" ? "#e75825" : "#181915", fontSize: 34 }}
      >
        {value}
      </strong>
    </div>
  );
}
