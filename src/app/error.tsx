"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="shell route-error" role="alert" aria-live="assertive">
      <AlertTriangle size={28} aria-hidden="true" />
      <p className="eyebrow">Route recovery / local failure</p>
      <h1>This view could not be assembled.</h1>
      <p>
        ForgeRank has not substituted cached estimates or invented missing values. Retry the local
        read, or return to a stable index surface.
      </p>
      <div>
        <button className="button button-primary" type="button" onClick={() => retry()}>
          <RotateCcw size={14} aria-hidden="true" /> Retry this view
        </button>
        <Link className="button button-secondary" href="/coverage">
          Inspect coverage
        </Link>
        <Link className="button button-secondary" href="/">
          Return home
        </Link>
      </div>
      {error.digest ? <small>Failure reference: {error.digest}</small> : null}
    </section>
  );
}
