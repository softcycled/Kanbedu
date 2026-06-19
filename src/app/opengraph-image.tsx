import { ImageResponse } from "next/og";

export const alt = "Kanbedu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLS = [
  { label: "To Do",       cards: [80, 60, 44], bg: "rgba(23,37,84,0.30)",   border: "#1e40af", dot: "#2563eb", text: "#93c5fd" },
  { label: "In Progress", cards: [80, 60],     bg: "rgba(69,26,3,0.30)",    border: "#92400e", dot: "#d97706", text: "#fcd34d" },
  { label: "Review",      cards: [80],         bg: "rgba(46,16,101,0.30)",  border: "#6b21a8", dot: "#9333ea", text: "#d8b4fe" },
  { label: "Done",        cards: [80, 60],     bg: "rgba(5,46,22,0.30)",    border: "#166534", dot: "#16a34a", text: "#86efac" },
];

async function fetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const [boldFont, regularFont] = await Promise.all([
    fetchFont("https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-Bold.ttf"),
    fetchFont("https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-Regular.ttf"),
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] = [];
  if (boldFont) fonts.push({ name: "Geist", data: boldFont, weight: 700, style: "normal" });
  if (regularFont) fonts.push({ name: "Geist", data: regularFont, weight: 400, style: "normal" });

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
        {/* Columns — staggered, rising from the bottom */}
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
              {/* Column header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: `1px solid ${col.border}`,
                  backgroundColor: col.bg,
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: col.dot,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: col.text,
                    letterSpacing: "-0.2px",
                    flex: 1,
                  }}
                >
                  {col.label}
                </div>
              </div>

              {/* Card zone */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "16px",
                  backgroundColor: "#23201E",
                }}
              >
                {col.cards.map((h, j) => (
                  <div
                    key={j}
                    style={{
                      height: `${h}px`,
                      width: "100%",
                      backgroundColor: "#302D2A",
                      borderRadius: "10px",
                      border: "1px solid #46433F",
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
            height: "370px",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "80px",
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
              fontSize: "20px",
              color: "#57534E",
              letterSpacing: "0.1px",
              fontWeight: 400,
            }}
          >
            Project boards. Without the noise.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length > 0 ? { fonts } : {}),
    }
  );
}
