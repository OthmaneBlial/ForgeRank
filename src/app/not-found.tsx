import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";

export default function NotFound() {
  return (
    <>
      <PageHeader
        eyebrow="404 / index boundary"
        title="That path is outside the index"
        description="The requested ForgeRank route does not exist, or the indexed entity is not available under that identity. No replacement record has been guessed."
      />
      <section className="shell content-section route-not-found">
        <SearchX size={28} aria-hidden="true" />
        <div>
          <h2>Continue from observed data</h2>
          <p>Search the current index, inspect coverage, or return to the discovery desk.</p>
        </div>
        <nav aria-label="Not found recovery">
          <Link className="button button-primary" href="/">
            <ArrowLeft size={14} aria-hidden="true" /> Return home
          </Link>
          <Link className="button button-secondary" href="/repositories">
            Browse repositories
          </Link>
          <Link className="button button-secondary" href="/coverage">
            Inspect coverage
          </Link>
        </nav>
      </section>
    </>
  );
}
