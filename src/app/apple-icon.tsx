import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Safari ignores an SVG apple touch icon, so this one is rendered to PNG at
 * build time rather than shipped as a file.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#EDE7D9",
        }}
      >
        <svg width="104" height="128" viewBox="0 0 26 32" fill="none">
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
      </div>
    ),
    size,
  );
}
