"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF7F2",
          color: "#161616",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#B91C1C",
              margin: 0,
            }}
          >
            Certly
          </p>
          <h1
            style={{ fontSize: 28, fontWeight: 800, margin: "12px 0 0", lineHeight: 1.15 }}
          >
            The application failed to load
          </h1>
          <p style={{ fontSize: 14, color: "#4B5563", marginTop: 12 }}>
            This is a fault on our side, not with your data. Reload the page to
            carry on.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: "#4B5563",
                background: "#fff",
                border: "1px solid #E5E0D8",
                borderRadius: 6,
                padding: "8px 12px",
                marginTop: 16,
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#B91C1C",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
