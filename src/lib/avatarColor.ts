export const AVATAR_PALETTE = [
  "#4A90A4", "#7B68EE", "#E8854A", "#5BAD6F", "#D4706A",
  "#A078C8", "#4E9E8F", "#C4885A", "#6B8DD6", "#D4956A",
];

export function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
