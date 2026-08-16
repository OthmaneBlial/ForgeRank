import { CompareBuilder } from "@/components/compare/compare-builder";
import { PageHeader } from "@/components/shell/page-header";
import { Layers3 } from "lucide-react";
import Link from "next/link";

export default function ComparePage() {
  return (
    <>
      <PageHeader
        eyebrow="Repository battles / normalized"
        title="Compare projects in context"
        description="Place two to five repositories side by side. Missing metrics stay missing; raw counts and normalized scores are kept distinct."
        aside={
          <Link className="button button-secondary" href="/compare/ecosystems">
            <Layers3 size={15} /> Compare ecosystems
          </Link>
        }
      />
      <section className="shell content-section">
        <CompareBuilder />
        <div className="comparison-principles">
          <div>
            <span>01</span>
            <strong>Comparable windows</strong>
            <p>Growth is compared only when observation windows overlap.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Explicit scope</strong>
            <p>Ranks refer to ForgeRank&apos;s current indexed universe.</p>
          </div>
          <div>
            <span>03</span>
            <strong>No synthetic history</strong>
            <p>Missing snapshots remain insufficient history.</p>
          </div>
        </div>
      </section>
    </>
  );
}
