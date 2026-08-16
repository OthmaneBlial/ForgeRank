import { Database, ExternalLink, FileClock, Scale, Shield } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";

export default function DataPolicyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Data policy / public signals"
        title="Conservative by design"
        description="What ForgeRank observes, what it refuses to collect, and how cached public information becomes transparent aggregate intelligence."
      />
      <article className="shell policy-grid">
        <Policy icon={Database} title="Sources we use">
          <p>
            Public repository and profile HTML where automated access is permitted, normal public
            Git protocol access, public repository files, version-controlled seed identifiers,
            licensed open datasets when explicitly documented, and ForgeRank&apos;s own snapshots.
          </p>
        </Policy>
        <Policy icon={Shield} title="Sources we never require">
          <p>
            No GitHub REST or GraphQL API, tokens, OAuth, GitHub Apps, authenticated sessions,
            hidden frontend endpoints, commercial data services, or external AI APIs are part of the
            core product.
          </p>
        </Policy>
        <Policy icon={FileClock} title="Caching & freshness">
          <p>
            ForgeRank prefers stale-but-valid cached observations over aggressive fetching. Hot
            repositories may be eligible for refresh every several hours; active repositories daily;
            cold repositories weekly or on demand. External policy and configured budgets always
            win.
          </p>
        </Policy>
        <Policy icon={Scale} title="Privacy & people">
          <p>
            ForgeRank analyzes public open-source contribution signals, not contactability. It does
            not display commit email addresses, harvest phone numbers, build marketing contact
            datasets, or infer private identity. Git authors stay distinct from confirmed public
            accounts.
          </p>
        </Policy>
        <Policy id="corrections" icon={ExternalLink} title="Corrections & removal">
          <p>
            Operators publish a project contact through <code>FORGERANK_CONTACT_URL</code>. A
            verified request can hide a developer page from detail, search, lists, and the sitemap,
            or set, hide, and later revert a public display-name, biography, or location field.
            Every action keeps a local reason and timestamp.
          </p>
          <p>
            Profile controls do not silently rewrite observed source evidence or delete legitimate
            repository-level aggregates. Operators can restore visibility or revert an override
            after review.
          </p>
        </Policy>
        <Policy icon={Scale} title="Independence">
          <p>
            ForgeRank is an independent open-source intelligence project and is not affiliated with,
            endorsed by, or an official product of GitHub. GitHub trademarks belong to their
            respective owners.
          </p>
        </Policy>
        <section className="policy-full">
          <p className="eyebrow">Operational promise</p>
          <h2>Failure must reduce collection, not increase it.</h2>
          <p>
            If robots policy cannot be verified, requests fail closed. Repeated parser failures open
            a circuit breaker. Rate-limit or retry-after responses pause collection. Cached pages
            and prior snapshots remain usable while the source is unavailable.
          </p>
        </section>
      </article>
    </>
  );
}

function Policy({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string;
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="policy-card">
      <Icon size={20} />
      <h2>{title}</h2>
      {children}
    </section>
  );
}
