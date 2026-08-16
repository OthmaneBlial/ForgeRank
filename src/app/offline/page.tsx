import { WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <section className="shell offline-page">
      <WifiOff size={29} />
      <p className="eyebrow">Offline shell</p>
      <h1>ForgeRank is between signals.</h1>
      <p>
        The network is unavailable. Recently viewed public pages may still be available from the
        local application cache; live ranking data is never labeled fresh while offline.
      </p>
      <Link className="button button-secondary" href="/">
        Return home
      </Link>
    </section>
  );
}
