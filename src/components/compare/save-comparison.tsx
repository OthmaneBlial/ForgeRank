"use client";

import { BookmarkPlus } from "lucide-react";
import { useState } from "react";

export function SaveComparison({ repositories }: { repositories: string[] }) {
  const [saved, setSaved] = useState(false);
  const save = () => {
    const key = "forgerank-comparisons-v1";
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      name: string;
      repositories: string[];
    }>;
    const signature = repositories.join(",");
    if (!existing.some((item) => item.repositories.join(",") === signature))
      existing.push({
        name: repositories.map((item) => item.split("/")[1]).join(" vs "),
        repositories,
      });
    localStorage.setItem(key, JSON.stringify(existing));
    setSaved(true);
  };
  return (
    <button className="button button-secondary" type="button" onClick={save}>
      <BookmarkPlus size={15} />
      {saved ? "Saved locally" : "Save comparison"}
    </button>
  );
}
