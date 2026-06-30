// =============================================================================
// La La Sweett — default Open Graph / social share image (1200×630)
// Auto-applied site-wide by Next.js for og:image and twitter:image, so links
// shared on Instagram / WhatsApp / iMessage / Facebook show a branded card.
// =============================================================================

import { ImageResponse } from "next/og";

export const alt =
  "La La Sweett — Custom Cakes & Wholesale Bakery in Austin, TX";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #FDEFF3 0%, #FBF2F5 55%, #FFFFFF 100%)",
        }}
      >
        <div
          style={{
            fontSize: 116,
            fontWeight: 700,
            color: "#8A4A63",
            letterSpacing: "-2px",
          }}
        >
          La La Sweett
        </div>
        <div style={{ marginTop: 28, fontSize: 48, color: "#C76B8A" }}>
          Custom Cakes &amp; Wholesale Bakery
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#7E6B74" }}>
          Austin, Texas
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 30,
            fontStyle: "italic",
            color: "#7E6B74",
          }}
        >
          Sweet moments with love
        </div>
      </div>
    ),
    { ...size },
  );
}
