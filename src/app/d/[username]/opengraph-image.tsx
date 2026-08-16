import { ImageResponse } from "next/og";

import { getDeveloperReadModel } from "@/application/read-model";

export const alt = "ForgeRank public developer intelligence card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function DeveloperOpenGraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const model = await getDeveloperReadModel(username);
  const developer = model?.developer;
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
        }}
      >
        <strong style={{ display: "flex", fontSize: 35 }}>
          Forge<span style={{ color: "#e75825" }}>Rank</span>
        </strong>
        <span
          style={{
            padding: "10px 16px",
            border: "1px solid #8d887f",
            background: "#f4f0e8",
            fontSize: 20,
          }}
        >
          PUBLIC PROFILE EVIDENCE
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            color: "#66645e",
            fontFamily: "Arial, sans-serif",
            fontSize: 21,
            letterSpacing: 4,
          }}
        >
          DEVELOPER INTELLIGENCE
        </span>
        <strong style={{ marginTop: 12, fontSize: 92, fontWeight: 500, lineHeight: 1 }}>
          {developer?.displayName ?? `@${username}`}
        </strong>
        <span
          style={{ marginTop: 20, color: "#53524d", fontFamily: "Arial, sans-serif", fontSize: 29 }}
        >
          @{developer?.username ?? username} · Git authors are never silently linked to accounts
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, fontFamily: "Arial, sans-serif" }}>
        <Metric label="DEVELOPER SCORE" value={developer?.currentScore ?? "—"} accent />
        <Metric label="CONFIDENCE" value={developer?.scoreConfidence ?? "INSUFFICIENT"} />
        <Metric
          label="OBSERVED PORTFOLIO"
          value={model ? String(model.repositories.length) : "0"}
        />
      </div>
    </div>,
    size,
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
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
      <strong style={{ marginTop: 5, color: accent ? "#e75825" : "#181915", fontSize: 34 }}>
        {value}
      </strong>
    </div>
  );
}
