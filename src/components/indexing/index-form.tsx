"use client";

import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function IndexForm() {
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("repository") ?? "");
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/repositories/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: value }),
      });
      const result = (await response.json()) as { message?: string };
      setStatus({
        kind: response.ok ? "success" : "error",
        message: result.message ?? "The request could not be recorded.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "ForgeRank could not reach its local indexing service.",
      });
    }
  };
  return (
    <form className="index-form" onSubmit={submit}>
      <label>
        <span>Public GitHub repository</span>
        <div>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://github.com/owner/repository"
            required
          />
          <button
            className="button button-primary"
            type="submit"
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading" ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ArrowRight size={16} />
            )}{" "}
            Request indexing
          </button>
        </div>
      </label>
      {status.kind !== "idle" && status.kind !== "loading" && (
        <p className={`form-status form-status-${status.kind}`}>
          {status.kind === "success" && <CheckCircle2 size={15} />}
          {status.message}
        </p>
      )}
    </form>
  );
}
