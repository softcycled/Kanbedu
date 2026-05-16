export type LabelColor = { id: string; name: string; hex: string };

export const LABEL_PALETTE: LabelColor[] = [
  { id: "grey", name: "Grey", hex: "#8e8e8e" },
  { id: "purple", name: "Purple", hex: "#6e59e5" },
  { id: "blue", name: "Blue", hex: "#3c46b4" },
  { id: "teal", name: "Teal", hex: "#31b4b9" },
  { id: "green", name: "Green", hex: "#5bad5c" },
  { id: "yellow", name: "Yellow", hex: "#E6C84A" },
  { id: "orange", name: "Orange", hex: "#D9884A" },
  { id: "red", name: "Red", hex: "#cf5252" },
];

export const LABEL_PALETTE_HEXES = LABEL_PALETTE.map((p) => p.hex);

function hexToRgb(hex: string) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

// Return a readable text color (either dark or white) for the given background color.
export function getTextColorForBg(hex: string): string {
  if (!hex) return '#ffffff';
  const { r, g, b } = hexToRgb(hex);
  // Convert sRGB to linear
  const srgb = [r / 255, g / 255, b / 255].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  // If the background is light, return a dark ink color; otherwise white.
  return L > 0.55 ? '#0F172A' : '#FFFFFF';
}
