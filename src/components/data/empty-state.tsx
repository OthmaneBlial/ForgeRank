import { DatabaseZap } from "lucide-react";
import Link from "next/link";

export function InsufficientData({
  title = "Not enough history yet.",
  detail = "ForgeRank only publishes trends after it has enough observed snapshots to support them.",
  action = true,
}: {
  title?: string;
  detail?: string;
  action?: boolean;
}) {
  return (
    <div className="insufficient-state">
      <DatabaseZap size={22} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action && <Link href="/coverage">Inspect coverage</Link>}
    </div>
  );
}
