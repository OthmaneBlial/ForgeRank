"use client";

import { GitCompareArrows, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EcosystemOption = { slug: string; name: string; count: number };

export function EcosystemCompareBuilder({
  candidates,
  initial,
}: {
  candidates: EcosystemOption[];
  initial: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const update = (index: number, value: string) => {
    setError(null);
    setValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = values.filter(Boolean);
    if (clean.length < 2 || clean.length > 5 || new Set(clean).size !== clean.length) {
      setError("Choose two to five different indexed ecosystems.");
      return;
    }
    router.push(`/compare/ecosystems/${clean.join(",")}`);
  };
  return (
    <form
      className="compare-builder"
      onSubmit={submit}
      aria-describedby={error ? "ecosystem-comparison-error" : undefined}
    >
      <div className="compare-inputs">
        {values.map((value, index) => (
          <label key={index}>
            <span>Ecosystem {index + 1}</span>
            <select
              value={value}
              onChange={(event) => update(index, event.target.value)}
              aria-label={`Ecosystem ${index + 1}`}
            >
              <option value="">Choose an indexed language</option>
              {candidates.map((candidate) => (
                <option key={candidate.slug} value={candidate.slug}>
                  {candidate.name} · {candidate.count} repositor
                  {candidate.count === 1 ? "y" : "ies"}
                </option>
              ))}
            </select>
            {values.length > 2 && (
              <button
                type="button"
                aria-label={`Remove ecosystem ${index + 1}`}
                onClick={() =>
                  setValues((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <X size={14} />
              </button>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p id="ecosystem-comparison-error" className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="compare-actions">
        {values.length < 5 && (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setValues((current) => [...current, ""])}
          >
            <Plus size={15} /> Add ecosystem
          </button>
        )}
        <button className="button button-primary" type="submit">
          <GitCompareArrows size={16} /> Compare ecosystems
        </button>
      </div>
    </form>
  );
}
