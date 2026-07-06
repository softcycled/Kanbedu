"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProGateModal from "./ProGateModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultMode?: "options" | "create" | "join";
}

// Create a new class (you become its educator) or join one with a code/link.
export default function CreateJoinClassModal({ isOpen, onClose, onCreated, defaultMode = "options" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"options" | "create" | "join" | "limit">(defaultMode);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setName("");
      setTerm("");
      setCode("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen, defaultMode]);

  useEffect(() => {
    if (mode !== "options") setTimeout(() => inputRef.current?.focus(), 0);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Please enter a class name.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, term: term.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "CLASS_LIMIT_REACHED") {
          setMode("limit");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to create class.");
      }
      onCreated?.();
      onClose();
      router.push(`/class/${data.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create class.");
      setLoading(false);
    }
  };

  const extractCode = (s: string) => {
    const v = s.trim();
    try {
      const u = new URL(v);
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("join");
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
      return parts[parts.length - 1] || v;
    } catch {
      const parts = v.split("/").filter(Boolean);
      const idx = parts.indexOf("join");
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
      return v;
    }
  };

  const submitJoin = () => {
    const c = extractCode(code);
    if (!c) return setError("Please paste a class link or code.");
    onClose();
    router.push(`/class/join/${c}`);
  };

  if (mode === "limit") {
    return (
      <ProGateModal
        isOpen
        title="Free plan limit reached"
        description="Free accounts can have up to 3 active classes at a time. Delete an existing class to free up a slot, or join the Pro waitlist to get notified when it's ready."
        onClose={onClose}
        onBack={() => setMode("options")}
      />
    );
  }

  return (
    <div data-modal-open role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in">
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-md motion-safe:animate-modal-in p-6 relative">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 p-1 rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {mode === "options" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Create or join a class</h2>
            <p className="text-xs text-muted mt-1">Start a class as an educator, or join one your teacher shared.</p>
            <div className="mt-6 grid gap-3">
              <button onClick={() => setMode("create")} className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors">Create class</button>
              <button onClick={() => setMode("join")} className="w-full px-4 py-3 rounded-xl text-sm font-medium border border-border text-ink bg-card-bg hover:bg-column-bg transition-colors">Join class</button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Create class</h2>
            <p className="text-xs text-muted mt-1">You&apos;ll be the educator and can set up groups and a preset.</p>
            <div className="mt-4 space-y-2">
              <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }} placeholder="Class name…" disabled={loading} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }} placeholder="Term (optional, e.g. Fall 2026)" disabled={loading} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30" />
              {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setMode("options")} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors disabled:opacity-50">Back</button>
              <button onClick={submitCreate} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50">{loading ? "Creating…" : "Create"}</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Join class</h2>
            <p className="text-xs text-muted mt-1">Paste the class link or code your teacher gave you.</p>
            <div className="mt-4">
              <input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitJoin(); }} placeholder="https://kanbedu.com/class/join/… or code" className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30" />
              {error && <p role="alert" className="text-xs text-red-500 mt-2">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setMode("options")} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors">Back</button>
              <button onClick={submitJoin} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors">Continue</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
