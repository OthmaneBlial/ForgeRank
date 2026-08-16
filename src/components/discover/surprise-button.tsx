"use client";

import { Dices } from "lucide-react";
import { useRouter } from "next/navigation";

export function SurpriseButton({ repositories }: { repositories: string[] }) {
  const router = useRouter();
  return (
    <button
      className="button button-secondary"
      type="button"
      disabled={repositories.length === 0}
      onClick={() => {
        const target = repositories[Math.floor(Math.random() * repositories.length)];
        if (target) router.push(`/r/${target}`);
      }}
    >
      <Dices size={16} /> Surprise me
    </button>
  );
}
