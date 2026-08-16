import { PageHeader } from "@/components/shell/page-header";
import { WatchlistClient } from "@/components/watchlist/watchlist-client";

export default function WatchlistPage() {
  return (
    <>
      <PageHeader
        eyebrow="Local first / no account"
        title="Project watchlist"
        description="Projects saved in this browser. ForgeRank does not require login, OAuth, or a remote profile to remember what matters to you."
      />
      <section className="shell content-section">
        <WatchlistClient />
      </section>
    </>
  );
}
