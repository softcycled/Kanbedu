import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kanbedu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLS = [
  { color: "#60A5FA", label: "To Do",       cards: [80, 60, 44] },
  { color: "#FB923C", label: "In Progress", cards: [80, 60] },
  { color: "#C084FC", label: "Review",      cards: [80] },
  { color: "#4ADE80", label: "Done",        cards: [80, 60] },
];

export default async function Image() {
  let fontData: ArrayBuffer | null = null;
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Geist:wght@700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" } }
    ).then((r) => r.text());
    const match = css.match(/src: url\((.+?)\) format\('woff2'\)/);
    if (match?.[1]) {
      fontData = await fetch(match[1]).then((r) => r.arrayBuffer());
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1C1917",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Geist, system-ui, sans-serif",
        }}
      >
        {/* Columns rising from the bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 100,
            width: 1000,
            display: "flex",
            alignItems: "flex-end",
            gap: "20px",
          }}
        >
          {COLS.map((col, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* Column header — matches ColumnHeader.tsx style */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${col.color}40`,
                  backgroundColor: `${col.color}18`,
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: col.color,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: col.color,
                    letterSpacing: "-0.2px",
                  }}
                >
                  {col.label}
                </div>
              </div>

              {/* Card stubs */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "14px",
                  backgroundColor: `${col.color}08`,
                  border: `1px solid ${col.color}18`,
                  flex: 1,
                }}
              >
                {col.cards.map((h, j) => (
                  <div
                    key={j}
                    style={{
                      height: `${h}px`,
                      width: "100%",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex",
                      flexDirection: "column",
                      padding: "12px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ height: "8px", width: "70%", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: "4px" }} />
                    {h > 52 && <div style={{ height: "6px", width: "45%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "4px" }} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Wordmark + tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "390px",
            gap: "18px",
          }}
        >
          <div
            style={{
              fontSize: "96px",
              fontWeight: 700,
              color: "#FAFAF9",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            kanbedu
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#57534E",
              letterSpacing: "0.3px",
              fontWeight: 400,
            }}
          >
            Kanban boards built for the classroom
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData
        ? { fonts: [{ name: "Geist", data: fontData, weight: 700, style: "normal" }] }
        : {}),
    }
  );
}
