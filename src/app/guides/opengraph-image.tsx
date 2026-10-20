import { ImageResponse } from "next/og";

export const alt = "Certly compliance guides for South African contractors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * One shared card for every page under /guides. The root image sells the
 * product; this one says "reference material", which is what somebody
 * pasting a deadline guide into a WhatsApp group is actually sharing.
 */
export default function GuidesOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#EDE7D9",
          color: "#16130E",
          padding: "60px 68px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "4px solid #16130E",
            paddingBottom: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="46" height="57" viewBox="0 0 26 32" fill="none">
              <path
                d="M4 0h13l9 9v19a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z"
                fill="#DC2626"
              />
              <path d="M17 0l9 9h-9V0Z" fill="#991B1B" />
              <path
                d="M17.9 10.07A5.9 5.9 0 1 0 17.9 16.33"
                stroke="#fff"
                strokeWidth="3.5"
                fill="none"
              />
              <rect x="5.2" y="22.6" width="11.6" height="2.7" rx="1.35" fill="#fff" />
              <rect x="5.2" y="26.2" width="7.8" height="2.7" rx="1.35" fill="#fff" />
            </svg>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
              CERTLY
            </span>
          </div>
          <span
            style={{
              fontSize: 20,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#5C574B",
            }}
          >
            Guides
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            The deadlines nobody tells you
            <br />
            about until you have missed one.
          </span>
          <span style={{ fontSize: 28, color: "#5C574B" }}>
            Employment equity, skills levy grants, letters of good standing and
            safety files, in plain language.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #C9C0A9",
            paddingTop: 20,
            fontSize: 22,
            color: "#5C574B",
          }}
        >
          <span>certly.co.za/guides</span>
          <span>Built in South Africa</span>
        </div>
      </div>
    ),
    size,
  );
}
