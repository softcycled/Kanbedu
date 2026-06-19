import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kanbedu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLS = [
  { color: "#60A5FA", height: 250, cards: [72, 52, 40] },
  { color: "#C084FC", height: 215, cards: [72, 52] },
  { color: "#FB923C", height: 230, cards: [72, 52] },
  { color: "#4ADE80", height: 200, cards: [72, 52] },
];

export default async function Image() {
  let fontData: ArrayBuffer | null = null;
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Geist:wght@300&display=swap",
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
                height: `${col.height}px`,
                display: "flex",
                flexDirection: "column",
                borderRadius: "14px 14px 0 0",
                border: "1px solid rgba(255,255,255,0.07)",
                borderBottom: "none",
                backgroundColor: "rgba(255,255,255,0.025)",
                padding: "16px 14px",
                gap: "10px",
              }}
            >
              {/* Colored accent dot + label row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: col.color,
                    opacity: 0.9,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    height: "8px",
                    width: "56px",
                    backgroundColor: col.color,
                    borderRadius: "4px",
                    opacity: 0.25,
                  }}
                />
              </div>
              {/* Card stubs */}
              {col.cards.map((h, j) => (
                <div
                  key={j}
                  style={{
                    height: `${h}px`,
                    width: "100%",
                    backgroundColor: "rgba(255,255,255,0.055)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "12px",
                    gap: "8px",
                  }}
                >
                  <div style={{ height: "8px", width: "70%", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "4px" }} />
                  {h > 52 && <div style={{ height: "6px", width: "45%", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: "4px" }} />}
                </div>
              ))}
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
              fontWeight: 300,
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
        ? { fonts: [{ name: "Geist", data: fontData, weight: 300, style: "normal" }] }
        : {}),
    }
  );
}
