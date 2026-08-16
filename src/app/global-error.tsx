"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "32px",
          color: "#171814",
          background: "#f4f1e9",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <title>ForgeRank recovery</title>
        <main style={{ width: "min(680px, 100%)", borderTop: "4px solid #b83b14" }}>
          <p
            style={{
              margin: "26px 0 10px",
              color: "#8d2c0d",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            ForgeRank / document recovery
          </p>
          <h1
            style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: "clamp(42px, 8vw, 72px)" }}
          >
            The application shell failed.
          </h1>
          <p style={{ color: "#5d5e56", fontSize: "17px", lineHeight: 1.6 }}>
            No ranking or repository evidence has been reconstructed. Retry the request to rebuild
            the document from its source state.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "12px",
              padding: "12px 18px",
              border: 0,
              color: "white",
              background: "#8d2c0d",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Retry ForgeRank
          </button>
          {error.digest ? (
            <small style={{ display: "block", marginTop: "18px", color: "#62635b" }}>
              Failure reference: {error.digest}
            </small>
          ) : null}
        </main>
      </body>
    </html>
  );
}
