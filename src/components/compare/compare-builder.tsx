"use client";

import { GitCompareArrows, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompareBuilder({
  initial = ["facebook/react", "vuejs/core"],
}: {
  initial?: string[];
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
    const clean = values.map((value) => value.trim()).filter(Boolean);
    const unique = new Set(clean.map((value) => value.toLowerCase()));
    if (
      clean.length < 2 ||
      clean.length > 5 ||
      unique.size !== clean.length ||
      clean.some((value) => !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value))
    ) {
      setError("Enter two to five repositories as owner/name.");
      return;
    }
    router.push(`/compare/${clean.join(",")}`);
  };
  return (
    <form
      className="compare-builder"
      onSubmit={submit}
      aria-describedby={error ? "comparison-error" : undefined}
    >
      <div className="compare-inputs">
        {values.map((value, index) => (
          <label key={index}>
            <span>Repository {index + 1}</span>
            <input
              aria-label={`Repository ${index + 1}`}
              value={value}
              onChange={(event) => update(index, event.target.value)}
              placeholder="owner/repository"
            />
            {values.length > 2 && (
              <button
                type="button"
                aria-label={`Remove repository ${index + 1}`}
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
        <p id="comparison-error" className="form-error" role="alert">
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
            <Plus size={15} /> Add repository
          </button>
        )}
        <button className="button button-primary" type="submit">
          <GitCompareArrows size={16} /> Compare
        </button>
      </div>
    </form>
  );
}
