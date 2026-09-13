import { ImageResponse } from "next/og";

export const alt = "Certly - nobody gets turned away at the gate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="32" viewBox="0 0 26 32" fill="none"><path d="M4 0h13l9 9v19a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4Z" fill="#DC2626"/><path d="M17 0l9 9h-9V0Z" fill="#991B1B"/><path d="M17.9 10.07A5.9 5.9 0 1 0 17.9 16.33" stroke="#fff" stroke-width="3.5" stroke-linecap="butt" fill="none"/><rect x="5.2" y="22.6" width="11.6" height="2.7" rx="1.35" fill="#fff"/><rect x="5.2" y="26.2" width="7.8" height="2.7" rx="1.35" fill="#fff"/></svg>`;
const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(MARK_SVG)}`;

export default async function OpengraphImage() {
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
            <img src={MARK} width={46} height={57} alt="" />
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
              CERTLY
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#5C574B" }}>
            FORM SA-01 &middot; REV 2026.1
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#C41E1E",
              letterSpacing: 4,
              marginBottom: 20,
            }}
          >
            SITE ACCESS COMPLIANCE &middot; SOUTH AFRICA
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -3,
              maxWidth: 940,
            }}
          >
            Nobody gets turned away at the gate.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #C9C0A9",
            paddingTop: 22,
            fontSize: 24,
            color: "#5C574B",
          }}
        >
          <div style={{ display: "flex" }}>
            Inductions, medicals, TEBA, competencies, safety files
          </div>
          <div style={{ display: "flex", color: "#C41E1E", fontWeight: 700 }}>
            R999 / month
          </div>
        </div>
      </div>
    ),
    size,
  );
}
