"use client";

import { Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function RepositoryFreshness({
  owner,
  name,
  updatedLabel,
  refreshTier,
}: {
  owner: string;
  name: string;
  updatedLabel: string;
  refreshTier: string;
}) {
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });
  const path = `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  useEffect(() => {
    void fetch(`${path}/view`, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [path]);

  async function requestRefresh() {
    setStatus({ kind: "loading" });
    try {
      const response = await fetch(`${path}/refresh`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      setStatus({
        kind: response.ok ? "success" : "error",
        message: result.message ?? "The refresh request could not be recorded.",
      });
    } catch {
      setStatus({ kind: "error", message: "ForgeRank could not reach its local queue." });
    }
  }

  return (
    <div className="repository-freshness">
      <span>
        <Clock3 size={14} />
        <strong>{updatedLabel}</strong>
        <small>{refreshTier.toLowerCase()} cadence</small>
      </span>
      <button
        className="button button-secondary"
        type="button"
        onClick={requestRefresh}
        disabled={status.kind === "loading"}
      >
        {status.kind === "loading" ? (
          <LoaderCircle className="spin" size={14} />
        ) : (
          <RefreshCw size={14} />
        )}
        Request refresh
      </button>
      {status.kind !== "idle" && (
        <p className={`refresh-status refresh-status-${status.kind}`} role="status">
          {status.kind === "loading"
            ? "Refresh requested; waiting for the local queue to confirm."
            : status.message}
        </p>
      )}
    </div>
  );
}
