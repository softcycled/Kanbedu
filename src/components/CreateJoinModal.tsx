"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onJoin: (inviteInput: string) => Promise<void>;
}

export default function CreateJoinModal({ isOpen, onClose, onCreate, onJoin }: Props) {
  const [mode, setMode] = useState<"options" | "create" | "join">("options");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode("options");
      setName("");
      setInvite("");
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === "create") setTimeout(() => inputRef.current?.focus(), 0);
    if (mode === "join") setTimeout(() => inputRef.current?.focus(), 0);
  }, [mode]);

  const close = () => {
    setError(null);
    setLoading(false);
    setName("");
    setInvite("");
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Please enter a board name.");
    setLoading(true);
    setError(null);
    try {
      await onCreate(trimmed);
      close();
    } catch (err: any) {
      setError(err?.message || "Failed to create board.");
    } finally {
      setLoading(false);
    }
  };

  const submitJoin = async () => {
    const val = invite.trim();
    if (!val) return setError("Please paste an invite link or token.");
    setLoading(true);
    setError(null);
    try {
      await onJoin(val);
      close();
    } catch (err: any) {
      setError(err?.message || "Failed to join board. The invite may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px]">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-md animate-modal-in p-6 relative">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 p-1 rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {mode === "options" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Create or join a board</h2>
            <p className="text-xs text-muted mt-1">Create a new board or join one with an invite link or code.</p>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => setMode("create")}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-ink text-card-bg hover:opacity-95 transition-colors"
              >
                Create board
              </button>

              <button
                onClick={() => setMode("join")}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium border border-border text-ink bg-card-bg hover:bg-column-bg transition-colors"
              >
                Join board
              </button>
            </div>

            {/* top-right close button replaces the bottom Cancel action */}
          </div>
        )}

        {mode === "create" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Create board</h2>
            <p className="text-xs text-muted mt-1">Give your board a short, clear name.</p>

            <div className="mt-4">
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); if (e.key === "Escape") close(); }}
                placeholder="Board name…"
                disabled={loading}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30"
              />
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setMode("options")} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50">Back</button>
              <button onClick={submitCreate} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50">{loading ? "Creating…" : "Create"}</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Join board</h2>
            <p className="text-xs text-muted mt-1">Paste an invite link or token to join a board.</p>

            <div className="mt-4">
              <input
                ref={inputRef}
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitJoin(); if (e.key === "Escape") close(); }}
                placeholder="https://kanbedu.com/invite/abc123 or abc123"
                disabled={loading}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30"
              />
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setMode("options")} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50">Back</button>
              <button onClick={submitJoin} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50">{loading ? "Joining…" : "Join"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
