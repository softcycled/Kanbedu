"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Avatar from "./Avatar";

// ── Types ─────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  name: string;
  color: string;
  handle: string | null;
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
  { name: "Channel Orange", hex: "#F37521", unlockedBy: "softcycled" },
];

const ALL_COLORS = [...AVATAR_COLORS, ...EXTRA_COLORS];
const DEFAULT_COLOR = AVATAR_COLORS[0].hex;

// ── Helpers ───────────────────────────────────────────────────

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

// ── Notifications tab ─────────────────────────────────────────

function NotificationsTab() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  const handlePushToggle = async (v: boolean) => {
    if (v) await subscribe();
    else await unsubscribe();
  };

  return (
    <div className="max-w-lg space-y-8">
      <div>
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
            <SettingRow
              label="Push notifications"
              description={
                !isSupported
                  ? "Not supported in this browser"
                  : isSubscribed
                  ? "Browser push notifications are enabled"
                  : "Enable browser push notifications for tasks and mentions"
              }
              disabled={!isSupported || isLoading}
            >
              {!isSupported ? (
                <span className="text-xs text-muted">Not supported</span>
              ) : (
                <Toggle checked={isSubscribed} onChange={handlePushToggle} disabled={isLoading} />
              )}
            </SettingRow>
          </SectionItem>
        </SectionBlock>
      </div>
    </div>
  );
}

// ── Appearance tab (needs useTheme, separate component so hook is always called) ──

function AppearanceTab() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-base font-semibold text-ink">Appearance</h2>
        <p className="text-sm text-muted mt-0.5">Customize the look and feel of Kanbedu</p>
      </div>
      <div className="space-y-6">
        <SectionTitle>UI Preferences</SectionTitle>
        <SectionBlock>
          <SectionItem>
            <SettingRow label="Light mode" description="Switch between dark and light themes">
              {mounted ? (
                <Toggle checked={!isDark} onChange={(v) => setTheme(v ? "light" : "dark")} />
              ) : (
                <div className="h-5 w-9 rounded-full bg-border motion-safe:animate-pulse" />
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

// ── Name Input Component ────────────────────────────────────────
// Controlled directly by the parent's `name` state so that the Save button
// and Enter key always persist the latest typed value. (A previous debounced
// local-state version could save a stale name when the user typed and saved
// within the debounce window.)
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
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSave()}
      disabled={saving}
      placeholder="Your name"
      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors mb-3"
    />
  );
}

// ── Main component ────────────────────────────────────────────

export default function ProfilePanel({ onClose }: { onClose?: () => void }) {
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

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Handle state
  const [handleValue, setHandleValue] = useState("");
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "same">("idle");
  const [handleSaving, setHandleSaving] = useState(false);
  const [handleSaved, setHandleSaved] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const handleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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
          setHandleValue(data.handle ?? "");
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

  // Handle availability debounce
  useEffect(() => {
    if (!handleValue) { setHandleStatus("idle"); return; }
    if (handleValue === profile?.handle) { setHandleStatus("same"); return; }
    setHandleStatus("checking");
    if (handleDebounceRef.current) clearTimeout(handleDebounceRef.current);
    handleDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/handle-check?handle=${encodeURIComponent(handleValue)}`);
        const data = await res.json();
        setHandleStatus(data.error ? "invalid" : data.available ? "available" : "taken");
      } catch { setHandleStatus("idle"); }
    }, 400);
    return () => { if (handleDebounceRef.current) clearTimeout(handleDebounceRef.current); };
  }, [handleValue, profile?.handle]);

  const handleSaveHandle = async () => {
    if (!profile || handleSaving || (handleStatus !== "available" && handleStatus !== "same")) return;
    if (handleValue === profile.handle) return;
    setHandleError(null);
    setHandleSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        setHandleSaved(true);
        setTimeout(() => setHandleSaved(false), 2000);
      } else {
        setHandleError(data.error ?? "Failed to save username.");
      }
    } catch {
      setHandleError("Something went wrong.");
    } finally {
      setHandleSaving(false);
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

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!deletePassword) { setDeleteError("Password is required."); return; }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        router.push("/login");
        router.refresh();
        return;
      }
      const data = await res.json();
      setDeleteError(data.error ?? "Failed to delete account.");
    } catch {
      setDeleteError("Something went wrong.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading…</div>;
  }

  const previewColor = hoverColor?.hex ?? color;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

      {/* ── Left nav ── */}
      <nav className="w-full md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-border h-auto md:h-full overflow-x-auto md:overflow-y-auto py-4 md:py-7 px-3 no-scrollbar flex md:block items-center gap-1">
        <p className="hidden md:block text-[11px] font-semibold uppercase tracking-widest text-muted px-3 mb-3">Settings</p>
        {onClose && (
          <button onClick={onClose} className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors mr-1" aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
        <ul className="flex md:block space-y-0 md:space-y-0.5 gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap md:w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === item.id
                    ? "bg-ink/8 text-ink font-medium"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink"
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
      <div className="flex-1 overflow-y-auto px-4 md:px-10 pt-6 pb-8 md:py-8 no-scrollbar">

        {/* Account */}
        {activeTab === "account" && (
          <div className="max-w-lg space-y-8">
            <div>
              <h2 className="text-base font-semibold text-ink">Account</h2>
              <p className="text-sm text-muted mt-0.5">Manage your personal details</p>
            </div>

            <div className="space-y-6">
              <SectionTitle>Profile</SectionTitle>
              <SectionBlock>
                <SectionItem>
                  <div className="py-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={name} color={previewColor} size="xl" className="select-none transition-colors duration-150" />
                      <div>
                        <p className="text-sm font-medium text-ink">{name || "No name set"}</p>
                        <p className="text-xs text-muted">{hoverColor ? hoverColor.name : profile?.handle ? `@${profile.handle}` : profile?.email ?? ""}</p>
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
                        const isUnlocked = handleValue.trim().toLowerCase() === c.unlockedBy.toLowerCase();
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
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saved ? "Saved" : saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </SectionItem>

                <SectionItem>
                  <div className="py-4">
                    <label className="block text-xs font-medium text-muted mb-1.5">Username</label>
                    <div className="relative mb-3">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted select-none">@</span>
                      <input
                        type="text"
                        value={handleValue}
                        onChange={(e) => setHandleValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveHandle()}
                        disabled={handleSaving}
                        maxLength={30}
                        placeholder="yourhandle"
                        className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-ink/30 transition-colors"
                      />
                    </div>
                    {handleValue && handleValue !== profile?.handle && (
                      <p className={`text-xs mb-2 ${
                        handleStatus === "available" ? "text-green-600 dark:text-green-400"
                          : handleStatus === "taken" || handleStatus === "invalid" ? "text-red-500"
                          : "text-muted"
                      }`}>
                        {handleStatus === "available" ? `@${handleValue} is available`
                          : handleStatus === "taken" ? "That username is already taken"
                          : handleStatus === "invalid" ? "2–30 chars, lowercase letters, numbers, underscores only"
                          : "Checking..."}
                      </p>
                    )}
                    {handleError && <p className="text-xs text-red-500 mb-2">{handleError}</p>}
                    <button
                      onClick={handleSaveHandle}
                      disabled={handleSaving || handleValue === profile?.handle || (handleStatus !== "available")}
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {handleSaved ? "Saved" : handleSaving ? "Saving…" : "Save username"}
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
                        className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                  <SettingRow label="Delete account" description="Permanently removes your account and all data">
                    <button
                      onClick={() => { setDeleteOpen(true); setDeletePassword(""); setDeleteError(null); }}
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/8 transition-colors"
                    >
                      Delete
                    </button>
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

            {/* Delete account modal */}
            {deleteOpen && (
              <div data-modal-open role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in">
                <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in p-6">
                  <p className="text-sm font-semibold text-ink">Delete account?</p>
                  <p className="text-xs text-muted mt-1">This permanently deletes your account and all data. This cannot be undone.</p>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-muted mb-1.5">Confirm your password</label>
                    <input
                      autoFocus
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleDeleteAccount()}
                      disabled={deleteLoading}
                      placeholder="Your password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-paper text-ink placeholder-muted/50 outline-none focus:border-red-400 transition-colors"
                    />
                    {deleteError && <p className="text-xs text-red-500 mt-2">{deleteError}</p>}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-5">
                    <button
                      onClick={() => setDeleteOpen(false)}
                      disabled={deleteLoading}
                      className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || !deletePassword}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? "Deleting…" : "Delete account"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appearance */}
        {activeTab === "appearance" && (
          <AppearanceTab />
        )}

        {/* Notifications */}
        {activeTab === "notifications" && <NotificationsTab />}

        {/* Boards */}
        {activeTab === "boards" && (
          <div className="max-w-lg space-y-8">
            <div>
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
            <div>
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
            <div>
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
