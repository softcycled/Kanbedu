"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import ConfirmModal from "../ConfirmModal";
import { useToasts } from "../Toasts";

interface Props {
  classId: string;
  initialName: string;
  initialTerm: string | null;
  archived: boolean;
  joinCode: string;
}

export default function ClassSettingsPanel({ classId, initialName, initialTerm, archived, joinCode }: Props) {
  const router = useRouter();
  const { push } = useToasts();
  const [name, setName] = useState(initialName);
  const [term, setTerm] = useState(initialTerm ?? "");
  const [isArchived, setIsArchived] = useState(archived);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Clone dialog state
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState(initialName);
  const [cloneTerm, setCloneTerm] = useState("");
  const [copyRoster, setCopyRoster] = useState(false);
  const [cloning, setCloning] = useState(false);

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/class/join/${joinCode}` : `/class/join/${joinCode}`;

  const patch = async (body: any, msg: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch failed");
      setSavedMsg(msg);
      setTimeout(() => setSavedMsg(null), 2000);
      router.refresh();
      return true;
    } catch {
      push({ title: "Couldn't save changes", description: "Please try again." });
      return false;
    }
  };

  const saveDetails = () => patch({ name: name.trim() || initialName, term: term.trim() || null }, "Saved");

  const toggleArchive = async () => {
    const next = !isArchived;
    setIsArchived(next);
    const ok = await patch({ archived: next }, next ? "Archived" : "Unarchived");
    if (!ok) setIsArchived(!next); // revert on failure
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 1500);
    } catch {
      push({ title: "Couldn't copy link", description: "Select the link and copy it manually." });
    }
  };

  const doClone = async () => {
    setCloning(true);
    try {
      const res = await fetch(`/api/classes/${classId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cloneName.trim() || undefined, term: cloneTerm.trim() || undefined, copyRoster }),
      });
      if (!res.ok) throw new Error("clone failed");
      const cls = await res.json();
      router.push(`/class/${cls.id}`);
    } catch {
      push({ title: "Couldn't clone class", description: "Please try again." });
      setCloning(false);
    }
  };

  const doDelete = async () => {
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.push("/");
    } catch {
      push({ title: "Couldn't delete class", description: "Please try again." });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-2xl">
      {/* Invite */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-ink mb-2">Class Invite</h3>
        <p className="text-xs text-muted mb-2">Share this link or QR code. Students join the lobby, then you sort them into groups.</p>
        <div className="flex items-center gap-2 mb-3">
          <input readOnly value={joinUrl} className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-column-bg text-ink/80 outline-none" />
          <button onClick={copyInvite} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors">
            {copyMsg ? "Copied" : "Copy"}
          </button>
          <button onClick={() => setShowQR((v) => !v)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card-bg text-ink hover:bg-column-bg transition-colors">
            {showQR ? "Hide QR" : "QR Code"}
          </button>
        </div>
        {showQR && (
          <div className="inline-flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-white">
            <QRCodeSVG value={joinUrl} size={200} />
            <p className="text-[11px] text-stone-500">Scan to join · {joinCode}</p>
          </div>
        )}
      </section>

      {/* Details */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-ink mb-2">Details</h3>
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-muted">Class name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={isArchived} className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30 disabled:opacity-60" />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Term (optional)</span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Fall 2026" disabled={isArchived} className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30 disabled:opacity-60" />
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={saveDetails} disabled={isArchived} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50">Save</button>
            {isArchived ? (
              <span className="text-xs text-muted">Unarchive below to edit details.</span>
            ) : (
              savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>
            )}
          </div>
        </div>
      </section>

      {/* Reuse Next Semester */}
      <section className="mb-8 border-t border-border/60 pt-6">
        <h3 className="text-sm font-semibold text-ink mb-1">Reuse Next Semester</h3>
        <p className="text-xs text-muted mb-3">Clone this class&apos;s preset and group structure into a fresh class with empty boards.</p>
        {!cloneOpen ? (
          <button onClick={() => setCloneOpen(true)} className="px-4 py-2 rounded-xl text-sm font-medium border border-border text-ink bg-card-bg hover:bg-column-bg transition-colors">Clone class…</button>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card-bg p-4 space-y-2">
            <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="New class name" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30" />
            <input value={cloneTerm} onChange={(e) => setCloneTerm(e.target.value)} placeholder="New term (e.g. Spring 2027)" className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30" />
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input type="checkbox" checked={copyRoster} onChange={(e) => setCopyRoster(e.target.checked)} />
              Also copy the current roster into the same groups
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={doClone} disabled={cloning} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50">{cloning ? "Cloning…" : "Create clone"}</button>
              <button onClick={() => setCloneOpen(false)} className="px-3 py-2 rounded-xl text-sm text-muted hover:text-ink transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="border-t border-border/60 pt-6">
        <h3 className="text-sm font-semibold text-ink mb-3">Archive &amp; Delete</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <button disabled className="px-4 py-2 rounded-xl text-sm font-medium border border-border text-ink/40 bg-card-bg cursor-not-allowed">
              {isArchived ? "Unarchive class" : "Archive class"}
            </button>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md text-[11px] bg-ink text-on-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              Coming soon
            </span>
          </div>
          <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 bg-card-bg hover:bg-red-50 transition-colors">
            Delete class
          </button>
        </div>
        <p className="text-xs text-muted mt-2">Archiving hides the class and stops new members from joining. Deleting removes everything permanently.</p>
      </section>

      <ConfirmModal
        isOpen={confirmDelete}
        danger
        title="Delete this class?"
        message={`"${name || initialName}" will be permanently deleted, along with every group and their boards. This cannot be undone.`}
        confirmLabel="Delete class"
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </div>
  );
}
