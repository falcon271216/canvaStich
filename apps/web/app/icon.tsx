import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Premium SketchUI mark: selection frame + corner handles.
 * Reads as a design/canvas tool, not a generic pen.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 16,
          background: "linear-gradient(160deg, #818CF8 0%, #4F46E5 42%, #6D28D9 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            background:
              "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 55%)",
          }}
        />
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          {/* Selection frame */}
          <rect
            x="9"
            y="10"
            width="24"
            height="20"
            rx="3.5"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            fill="rgba(255,255,255,0.12)"
          />
          {/* Inner accent bar (UI chrome) */}
          <rect x="13" y="15" width="16" height="2.8" rx="1.4" fill="#FFFFFF" fillOpacity="0.95" />
          <rect x="13" y="21" width="11" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity="0.55" />
          {/* Corner handles */}
          <rect x="6.2" y="7.2" width="5.4" height="5.4" rx="1.2" fill="#FFFFFF" />
          <rect x="30.4" y="7.2" width="5.4" height="5.4" rx="1.2" fill="#FFFFFF" />
          <rect x="6.2" y="29.4" width="5.4" height="5.4" rx="1.2" fill="#FFFFFF" />
          <rect x="30.4" y="29.4" width="5.4" height="5.4" rx="1.2" fill="#C4B5FD" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
