"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

// ── Types ─────────────────────────────────────────────────────

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

type SettingsTab =
  | "account"
  | "appearance"
  | "notifications"
  | "boards"
  | "accessibility"
  | "privacy";

// ── Avatar palette ────────────────────────────────────────────

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

const EXTRA_COLORS: AvatarColor[] = [];

interface LockedColor extends AvatarColor {
  unlockedBy: string;
}

const LOCKED_COLORS: LockedColor[] = [
  { name: "Channel Orange", hex: "#F37521", unlockedBy: "jorge" },
];

const ALL_COLORS = [...AVATAR_COLORS, ...EXTRA_COLORS];
const DEFAULT_COLOR = AVATAR_COLORS[0].hex;

// ── Helpers ───────────────────────────────────────────────────

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.57 ? "#1C1917" : "#FAFAF9";
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ── Reusable primitives ───────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        disabled
          ? "cursor-not-allowed opacity-40 bg-muted/40"
          : checked
          ? "cursor-pointer bg-ink/15 dark:bg-ink/30"
          : "cursor-pointer bg-ink/60 dark:bg-ink"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow transform transition-transform duration-200 ${
          checked
            ? "translate-x-4 bg-ink/60 dark:bg-ink"
            : "translate-x-0 bg-paper dark:bg-paper"
        }`}
      />
    </button>
  );
}

function SettingRow({ label, description, children, disabled = false }: {
  label: string;
  description?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3.5 ${disabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
      <div className="min-w-0 pr-8">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-border text-muted">
      Coming soon
    </span>
  );
}

function SectionBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border border border-border rounded-xl shadow-sm">
      {children}
    </div>
  );
}

function SectionItem({ children }: { children: React.ReactNode }) {
  return <div className="px-5">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">{children}</h3>;
}

// ── Nav icons ─────────────────────────────────────────────────

function IconAccount() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7.5" cy="5" r="2.5" />
      <path d="M2 13c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
    </svg>
  );
}

function IconAppearance() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="3" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M3.2 11.8l1.1-1.1M10.7 4.3l1.1-1.1" />
    </svg>
  );
}

function IconNotifications() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M7.5 1.5a5 5 0 0 1 5 5v3l1 2H1.5l1-2v-3a5 5 0 0 1 5-5z" />
      <path d="M6 11.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function IconBoards() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconAccessibility() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7.5" cy="3" r="1.5" />
      <path d="M2 6h11M7.5 6v7M5 13l2.5-4 2.5 4" />
    </svg>
  );
}

function IconPrivacy() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M7.5 1L2 3.5v4c0 3 2.5 5.5 5.5 6.5 3-1 5.5-3.5 5.5-6.5v-4L7.5 1z" />
    </svg>
  );
}

// ── Sidebar nav items ─────────────────────────────────────────

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account",       label: "Account",           icon: <IconAccount /> },
  { id: "appearance",    label: "Appearance",         icon: <IconAppearance /> },
  { id: "notifications", label: "Notifications",      icon: <IconNotifications /> },
  { id: "boards",        label: "Boards",             icon: <IconBoards /> },
  { id: "accessibility", label: "Accessibility",      icon: <IconAccessibility /> },
  { id: "privacy",       label: "Privacy & Security", icon: <IconPrivacy /> },
];

// ── Appearance tab (needs useTheme, separate component so hook is always called) ──

function AppearanceTab() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <div className="max-w-lg space-y-8">
      <div className="pl-14 md:pl-0">
        <h2 className="text-base font-semibold text-ink">Appearance</h2>
        <p className="text-sm text-muted mt-0.5">Customize the look and feel of Kanbedu</p>
      </div>
      <div className="space-y-6">
        <SectionTitle>UI Preferences</SectionTitle>
        <SectionBlock>
          <SectionItem>
            <SettingRow label="Dark mode" description="Switch between light and dark themes">
              {mounted ? (
                <Toggle checked={isDark} onChange={(v) => setTheme(v ? "dark" : "light")} />
              ) : (
                <div className="h-5 w-9 rounded-full bg-border animate-pulse" />
              )}
            </SettingRow>
          </SectionItem>
          <SectionItem>
            <SettingRow label="Compact mode" description="Reduce spacing for a denser layout" disabled>
              <ComingSoonBadge />
            </SettingRow>
          </SectionItem>
          <SectionItem>
            <SettingRow label="Reduced motion" description="Minimize animations and transitions" disabled>
              <ComingSoonBadge />
            </SettingRow>
          </SectionItem>
        </SectionBlock>
      </div>
    </div>
  );
}

// ── Name Input Component (Performance Fix) ──────────────────────
function NameInput({ 
  value, 
  onChange, 
  onSave, 
  saving 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onSave: () => void; 
  saving: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  
  // Sync if external value changes (e.g. from fetch)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the upward change to avoid lag during rapid typing
  useEffect(() => {
    const timeout = setTimeout(() => onChange(localValue), 300);
    return () => clearTimeout(timeout);
  }, [localValue, onChange]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSave()}
      disabled={saving}
      placeholder="Your name"
      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors mb-3"
    />
  );
}

// ── Main component ────────────────────────────────────────────

export default function ProfilePanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  // Account state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hoverColor, setHoverColor] = useState<AvatarColor | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // Boards state (localStorage-backed)
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("kanbedu-show-completed");
    if (stored === "true") setShowCompleted(true);
  }, []);

  const handleShowCompletedToggle = (v: boolean) => {
    setShowCompleted(v);
    localStorage.setItem("kanbedu-show-completed", String(v));
  };

  // Fetch profile
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

  const handlePasswordChange = async () => {
    setPwError(null);
    if (!pwCurrent || !pwNew || !pwConfirm) { setPwError("All fields are required."); return; }
    if (pwNew.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { setPwError("Passwords do not match."); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      if (res.ok) {
        setPwCurrent(""); setPwNew(""); setPwConfirm("");
        setPwSaved(true);
        setTimeout(() => setPwSaved(false), 2500);
      } else {
        const d = await res.json();
        setPwError(d.error ?? "Failed to update password.");
      }
    } catch {
      setPwError("Something went wrong.");
    } finally {
      setPwSaving(false);
    }
  };

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
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading…</div>;
  }

  const initials = getInitials(name) || "?";
  const previewColor = hoverColor?.hex ?? color;
  const textColor = getTextColor(previewColor);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

      {/* ── Left nav ── */}
      <nav className="w-full md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-border h-auto md:h-full overflow-x-auto md:overflow-y-auto py-4 md:py-7 pl-14 pr-3 md:px-3 no-scrollbar flex md:block items-center gap-1">
        <p className="hidden md:block text-[11px] font-semibold uppercase tracking-widest text-muted px-3 mb-3">Settings</p>
        <ul className="flex md:block space-y-0 md:space-y-0.5 gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap md:w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === item.id
                    ? "bg-border text-ink font-medium"
                    : "text-muted hover:text-ink hover:bg-border/50"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Right content ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 pt-6 pb-32 md:py-8 no-scrollbar">

        {/* Account */}
        {activeTab === "account" && (
          <div className="max-w-lg space-y-8">
            <div className="pl-14 md:pl-0">
              <h2 className="text-base font-semibold text-ink">Account</h2>
              <p className="text-sm text-muted mt-0.5">Manage your personal details</p>
            </div>

            <div className="space-y-6">
              <SectionTitle>Profile</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <div className="py-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold select-none flex-shrink-0 transition-colors duration-150"
                        style={{ backgroundColor: previewColor, color: textColor }}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{name || "No name set"}</p>
                        <p className="text-xs text-muted">{hoverColor ? hoverColor.name : profile?.email ?? ""}</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted mb-2">Avatar color</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_COLORS.map((c) => {
                        const isSelected = color === c.hex;
                        const isHovered = hoverColor?.hex === c.hex;
                        return (
                          <button
                            key={c.hex}
                            onClick={() => handleColorClick(c.hex)}
                            onMouseEnter={() => setHoverColor(c)}
                            onMouseLeave={() => setHoverColor(null)}
                            className={`w-6 h-6 rounded-full transition-all duration-150 ${
                              isSelected ? "ring-2 ring-offset-2 ring-ink scale-110" : isHovered ? "scale-105 ring-1 ring-black/20" : "ring-1 ring-black/10"
                            }`}
                            style={{ backgroundColor: c.hex, boxShadow: isHovered && !isSelected ? `0 2px 8px ${c.hex}80` : undefined }}
                            aria-label={c.name}
                            aria-pressed={isSelected}
                          />
                        );
                      })}
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
                              className={`w-6 h-6 rounded-full transition-all duration-150 ${
                                isSelected ? "ring-2 ring-offset-2 ring-ink scale-110" : isHovered ? "scale-105 ring-1 ring-black/20" : "ring-1 ring-black/10"
                              }`}
                              style={{ backgroundColor: c.hex, boxShadow: isHovered && !isSelected ? `0 2px 8px ${c.hex}80` : undefined }}
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
                            className="w-6 h-6 rounded-full ring-1 ring-black/10 bg-[#D4D0CB] flex items-center justify-center cursor-not-allowed"
                          >
                            <svg width="9" height="11" viewBox="0 0 10 12" fill="none" className="opacity-40">
                              <rect x="2" y="5" width="6" height="6" rx="1" fill="#1C1917" />
                              <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#1C1917" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </SectionItem>

                <SectionItem>
                  <div className="py-4">
                    <label className="block text-xs font-medium text-muted mb-1.5">Display name</label>
                    <NameInput
                      value={name}
                      onChange={setName}
                      onSave={handleSave}
                      saving={saving}
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-50"
                    >
                      {saved ? "Saved!" : saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </SectionItem>

                <SectionItem>
                  <div className="py-4">
                    <label className="block text-xs font-medium text-muted mb-1.5">Email address</label>
                    <p className="text-sm text-ink/70 px-3 py-2 border border-border bg-border/30 rounded-lg">
                      {profile?.email ?? "…"}
                    </p>
                  </div>
                </SectionItem>
              </SectionBlock>
            </div>

            <div className="space-y-6">
              <SectionTitle>Password</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <div className="py-4 space-y-2">
                    <input
                      type="password"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
                    />
                    <input
                      type="password"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
                    />
                    <input
                      type="password"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
                    />
                    {pwError && <p className="text-xs text-red-500 pt-1">{pwError}</p>}
                    <div className="pt-1">
                      <button
                        onClick={handlePasswordChange}
                        disabled={pwSaving}
                        className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-ink text-paper hover:bg-ink/80 transition-colors disabled:opacity-50"
                      >
                        {pwSaved ? "Password updated!" : pwSaving ? "Updating…" : "Update password"}
                      </button>
                    </div>
                  </div>
                </SectionItem>
              </SectionBlock>
            </div>

            <div className="space-y-6">
              <SectionTitle>More</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="Profile picture" description="Upload a custom avatar" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Connected accounts" description="Link third-party services" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Delete account" description="Permanently remove your data" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>

            <div className="pt-2 pb-6">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        )}

        {/* Appearance */}
        {activeTab === "appearance" && (
          <AppearanceTab />
        )}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <div className="max-w-lg space-y-8">
            <div className="pl-14 md:pl-0">
              <h2 className="text-base font-semibold text-ink">Notifications</h2>
              <p className="text-sm text-muted mt-0.5">Control what alerts you receive</p>
            </div>
            <div className="space-y-6">
              <SectionTitle>Alerts & Updates</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="Task assigned" description="Notify when a task is assigned to you" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Comments & mentions" description="Notify when someone comments or mentions you" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Deadline reminders" description="Get reminded before tasks are due" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Board invitations" description="Notify when you are invited to a board" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Push notifications" description="Mobile push notifications (coming later)" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>
          </div>
        )}

        {/* Boards */}
        {activeTab === "boards" && (
          <div className="max-w-lg space-y-8">
            <div className="pl-14 md:pl-0">
              <h2 className="text-base font-semibold text-ink">Boards</h2>
              <p className="text-sm text-muted mt-0.5">Defaults and display preferences for your boards</p>
            </div>
            <div className="space-y-6">
              <SectionTitle>Display</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="Show completed tasks" description="Display tasks in the Done column on the board" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Default board" description="Board to open on login" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>
          </div>
        )}

        {/* Accessibility */}
        {activeTab === "accessibility" && (
          <div className="max-w-lg space-y-8">
            <div className="pl-14 md:pl-0">
              <h2 className="text-base font-semibold text-ink">Accessibility</h2>
              <p className="text-sm text-muted mt-0.5">Make Kanbedu work better for you</p>
            </div>
            <div className="space-y-6">
              <SectionTitle>Display & Interaction</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="High contrast mode" description="Increase color contrast for readability" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Keyboard shortcuts" description="Enable and customize keyboard navigation" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Screen reader support" description="Optimizations for assistive technologies" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>
          </div>
        )}

        {/* Privacy & Security */}
        {activeTab === "privacy" && (
          <div className="max-w-lg space-y-8">
            <div className="pl-14 md:pl-0">
              <h2 className="text-base font-semibold text-ink">Privacy & Security</h2>
              <p className="text-sm text-muted mt-0.5">Control your data and account security</p>
            </div>
            <div className="space-y-6">
              <SectionTitle>Security</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="Two-factor authentication" description="Add an extra layer of security to your account" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Active sessions" description="View and revoke active login sessions" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>
            <div className="space-y-6">
              <SectionTitle>Privacy</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <SettingRow label="Activity visibility" description="Control who can see your activity on boards" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
                <SectionItem>
                  <SettingRow label="Data export" description="Download a copy of your data" disabled>
                    <ComingSoonBadge />
                  </SettingRow>
                </SectionItem>
              </SectionBlock>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
