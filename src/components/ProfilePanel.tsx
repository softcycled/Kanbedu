"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  color: string;
}

interface AvatarColor {
  name: string;
  hex: string;
}

// Core palette
const AVATAR_COLORS: AvatarColor[] = [
  { name: "Ocean Blue",      hex: "#4A90A4" },
  { name: "Ice Blue",        hex: "#A8CCE0" },
  { name: "Midnight Blue",   hex: "#2C4A6E" },
  { name: "Forest Green",    hex: "#4A7C59" },
  { name: "Mint Green",      hex: "#7CC8A0" },
  { name: "Olive Green",     hex: "#7A8C52" },
  { name: "Emerald Green",   hex: "#3D8B6B" },
  { name: "Golden Yellow",   hex: "#D4A847" },
  { name: "Sand Yellow",     hex: "#C9B87A" },
  { name: "Clay Orange",     hex: "#BE6A43" },
  { name: "Rose Red",        hex: "#C45C6A" },
  { name: "Coral Red",       hex: "#D47060" },
  { name: "Crimson Red",     hex: "#A83252" },
  { name: "Blush Pink",      hex: "#D4A0A8" },
  { name: "Lavender Purple", hex: "#9B8CC4" },
  { name: "Violet Purple",   hex: "#7A5FAF" },
];

// Add special/developer colors here without modifying the list above
const EXTRA_COLORS: AvatarColor[] = [];

interface LockedColor extends AvatarColor {
  unlockedBy: string; // exact name that unlocks it
}

const LOCKED_COLORS: LockedColor[] = [
  { name: "Channel Orange", hex: "#F37521", unlockedBy: "jorge" },
];

const ALL_COLORS = [...AVATAR_COLORS, ...EXTRA_COLORS];

const DEFAULT_COLOR = AVATAR_COLORS[0].hex;

/** Returns dark or light text color depending on background luminance */
function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.57 ? "#1C1917" : "#FAFAF9";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export default function ProfilePanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hoverColor, setHoverColor] = useState<AvatarColor | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data: UserProfile = await res.json();
          setProfile(data);
          setName(data.name);
          setColor(data.color || DEFAULT_COLOR);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = useCallback(async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const updated: UserProfile = await res.json();
        setProfile(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setSaving(false);
    }
  }, [profile, name, color, saving]);

  const handleColorClick = useCallback(async (hex: string) => {
    setColor(hex);
    if (!profile) return;
    // Save color immediately
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: hex }),
      });
      if (res.ok) {
        const updated: UserProfile = await res.json();
        setProfile(updated);
      }
    } catch (error) {
      console.error("Failed to save color:", error);
    }
  }, [profile]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading profile...
      </div>
    );
  }

  const initials = getInitials(name) || "?";
  const previewColor = hoverColor?.hex ?? color;
  const textColor = getTextColor(previewColor);

  return (
    <div className="flex-1 px-10 py-8">
      <h2 className="text-xl font-bold text-ink mb-1">Profile</h2>
      <p className="text-sm text-muted mb-8">Your personal details</p>

      <div className="max-w-sm">
        {/* Avatar preview */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold select-none flex-shrink-0 transition-colors duration-150"
            style={{ backgroundColor: previewColor, color: textColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              {name || "No name set"}
            </p>
            <p className="text-xs text-muted transition-all duration-100">
              {hoverColor ? hoverColor.name : profile?.email ?? "Avatar color"}
            </p>
          </div>
        </div>

        {/* Color picker */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_COLORS.map((c) => {
              const isSelected = color === c.hex;
              const isHovered = hoverColor?.hex === c.hex;
              return (
                <button
                  key={c.hex}
                  onClick={() => handleColorClick(c.hex)}
                  onMouseEnter={() => setHoverColor(c)}
                  onMouseLeave={() => setHoverColor(null)}
                  className={`w-7 h-7 rounded-full transition-all duration-150 ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-ink scale-110"
                      : isHovered
                      ? "scale-105 ring-1 ring-black/20"
                      : "ring-1 ring-black/10"
                  }`}
                  style={{
                    backgroundColor: c.hex,
                    boxShadow: isHovered && !isSelected ? `0 2px 8px ${c.hex}80` : undefined,
                  }}
                  aria-label={c.name}
                  aria-pressed={isSelected}
                />
              );
            })}

            {/* Easter egg / locked colors */}
            {LOCKED_COLORS.map((c) => {
              const isUnlocked = name.trim().toLowerCase() === c.unlockedBy.toLowerCase();
              const isSelected = color === c.hex;
              const isHovered = hoverColor?.hex === c.hex;
              if (isUnlocked) {
                return (
                  <button
                    key={c.hex}
                    onClick={() => handleColorClick(c.hex)}
                    onMouseEnter={() => setHoverColor(c)}
                    onMouseLeave={() => setHoverColor(null)}
                    className={`w-7 h-7 rounded-full transition-all duration-150 ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-ink scale-110"
                        : isHovered
                        ? "scale-105 ring-1 ring-black/20"
                        : "ring-1 ring-black/10"
                    }`}
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: isHovered && !isSelected ? `0 2px 8px ${c.hex}80` : undefined,
                    }}
                    aria-label={c.name}
                    aria-pressed={isSelected}
                  />
                );
              }
              return (
                <div
                  key={c.hex}
                  onMouseEnter={() => setHoverColor({ name: "???", hex: "#9E9E9E" })}
                  onMouseLeave={() => setHoverColor(null)}
                  className="w-7 h-7 rounded-full ring-1 ring-black/10 bg-[#D4D0CB] flex items-center justify-center cursor-not-allowed"
                  aria-label="Locked color"
                >
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="opacity-40">
                    <rect x="2" y="5" width="6" height="6" rx="1" fill="#1C1917"/>
                    <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#1C1917" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        {/* Name field */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Your name"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
          />
        </div>

        {/* Email (read-only) */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Email
          </label>
          <p className="text-sm text-ink/70 px-3 py-2">
            {profile?.email ?? "..."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-50"
          >
            {saved ? "Saved!" : saving ? "Saving..." : "Save profile"}
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
