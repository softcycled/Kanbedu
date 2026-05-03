"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "kanbedu-profile";

interface Profile {
  name: string;
  initials: string;
  color: string;
}

const AVATAR_COLORS = [
  "bg-blue-200 text-blue-800",
  "bg-amber-200 text-amber-800",
  "bg-green-200 text-green-800",
  "bg-purple-200 text-purple-800",
  "bg-pink-200 text-pink-800",
  "bg-cyan-200 text-cyan-800",
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export default function ProfilePanel() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    initials: "",
    color: AVATAR_COLORS[0],
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setProfile(JSON.parse(stored));
    } catch {}
  }, []);

  const handleSave = () => {
    const updated = {
      ...profile,
      initials: getInitials(profile.name) || "?",
    };
    setProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 px-10 py-8">
      <h2 className="text-xl font-bold text-ink mb-1">Profile</h2>
      <p className="text-sm text-muted mb-8">Your personal details</p>

      <div className="max-w-sm">
        {/* Avatar preview */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold select-none ${profile.color}`}
          >
            {profile.initials || "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              {profile.name || "No name set"}
            </p>
            <p className="text-xs text-muted">Avatar color</p>
            <div className="flex gap-1 mt-1">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setProfile((p) => ({ ...p, color }))}
                  className={`w-5 h-5 rounded-full ${color.split(" ")[0]} border-2 transition-all ${
                    profile.color === color
                      ? "border-ink scale-110"
                      : "border-transparent hover:border-ink/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Name field */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Name
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Your name"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
          />
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-ink text-paper hover:bg-ink/80 transition-colors"
        >
          {saved ? "Saved!" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
