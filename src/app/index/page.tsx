import { Suspense } from "react";
import { Clock3, DatabaseZap, ShieldCheck } from "lucide-react";

import { IndexForm } from "@/components/indexing/index-form";
import { PageHeader } from "@/components/shell/page-header";

export default function IndexPage() {
  return (
    <>
      <PageHeader
        eyebrow="Index intake / public URLs"
        title="Add a repository to the index"
        description="Submit a public repository identifier. Requests enter a bounded, deduplicated queue; a click never triggers unbounded scraping."
      />
      <section className="shell content-section narrow-content">
        <Suspense>
          <IndexForm />
        </Suspense>
        <div className="intake-rules">
          <div>
            <ShieldCheck size={20} />
            <strong>Strict host allowlist</strong>
            <p>
              Only public HTTPS github.com repository roots are accepted. Credentials, ports, and
              arbitrary hosts are rejected.
            </p>
          </div>
          <div>
            <Clock3 size={20} />
            <strong>Policy-governed refresh</strong>
            <p>
              Robots policy, crawl budgets, backoff, and cache freshness are checked before public
              documents are requested.
            </p>
          </div>
          <div>
            <DatabaseZap size={20} />
            <strong>Progressive enrichment</strong>
            <p>
              A lightweight observation comes first. Historical and Git-derived intelligence
              accumulates only when policy permits.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
