"use client";

import { useState, useEffect } from "react";

interface PColumn { label: string; isDone: boolean; }
interface PTask { title: string; description: string; columnIndex: number; priority: string; }

interface Props { classId: string; }

const PRIORITIES = ["low", "medium", "high", "urgent"];

// Editor for the class preset: the starting columns and seed tasks every NEW
// group board is created from. Editing never mutates existing group boards.
export default function PresetEditor({ classId }: Props) {
  const [columns, setColumns] = useState<PColumn[]>([]);
  const [tasks, setTasks] = useState<PTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/classes/${classId}/preset`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { columns: [], tasks: [] }))
      .then((data) => {
        if (cancelled) return;
        setColumns(data.columns || []);
        setTasks(data.tasks || []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId]);

  const markDirty = () => { setSaved(false); setError(null); };

  const addColumn = () => { setColumns((c) => [...c, { label: "New column", isDone: false }]); markDirty(); };
  const removeColumn = (idx: number) => {
    setColumns((c) => c.filter((_, i) => i !== idx));
    // Re-point or drop tasks referencing removed/shifted columns.
    setTasks((ts) =>
      ts
        .filter((t) => t.columnIndex !== idx)
        .map((t) => (t.columnIndex > idx ? { ...t, columnIndex: t.columnIndex - 1 } : t))
    );
    markDirty();
  };
  const setColumnLabel = (idx: number, label: string) => {
    setColumns((c) => c.map((col, i) => (i === idx ? { ...col, label } : col)));
    markDirty();
  };
  const setDoneColumn = (idx: number) => {
    setColumns((c) => c.map((col, i) => ({ ...col, isDone: i === idx ? !col.isDone : false })));
    markDirty();
  };

  const addTask = () => { setTasks((t) => [...t, { title: "New task", description: "", columnIndex: 0, priority: "medium" }]); markDirty(); };
  const removeTask = (idx: number) => { setTasks((t) => t.filter((_, i) => i !== idx)); markDirty(); };
  const updateTask = (idx: number, patch: Partial<PTask>) => {
    setTasks((t) => t.map((task, i) => (i === idx ? { ...task, ...patch } : task)));
    markDirty();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/preset`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns, tasks }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save preset.");
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "Failed to save preset.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading preset…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-3xl">
      <p className="text-xs text-muted mb-5">
        This is the starting layout for every <em>new</em> group board. Changing it won&apos;t touch boards that already exist.
      </p>

      {/* Columns */}
      <h3 className="text-sm font-semibold text-ink mb-2">Columns</h3>
      <div className="space-y-2 mb-3">
        {columns.map((col, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={col.label}
              onChange={(e) => setColumnLabel(i, e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30"
            />
            <button
              onClick={() => setDoneColumn(i)}
              className={`w-28 shrink-0 text-center text-[11px] py-1.5 rounded-lg border transition-colors ${
                col.isDone ? "border-emerald-400/70 text-emerald-700 bg-emerald-400/10" : "border-border text-muted hover:text-ink"
              }`}
              title="Mark as the 'done' column"
            >
              {col.isDone ? "Done column" : "Mark done"}
            </button>
            <button onClick={() => removeColumn(i)} className="w-6 shrink-0 flex items-center justify-center text-muted hover:text-red-500 text-sm" title="Remove column">✕</button>
          </div>
        ))}
      </div>
      <button onClick={addColumn} className="text-xs text-muted hover:text-ink mb-8">+ Add column</button>

      {/* Seed tasks */}
      <h3 className="text-sm font-semibold text-ink mb-2">Seed Tasks</h3>
      <p className="text-xs text-muted mb-3">Tasks every group starts with (optional).</p>
      <div className="space-y-2 mb-3">
        {tasks.map((t, i) => (
          <div key={i} className="rounded-xl border border-border/70 bg-card-bg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={t.title}
                onChange={(e) => updateTask(i, { title: e.target.value })}
                placeholder="Task title"
                className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none focus:border-ink/30"
              />
              <button onClick={() => removeTask(i)} className="text-muted hover:text-red-500 text-sm px-1" title="Remove task">✕</button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={t.columnIndex}
                onChange={(e) => updateTask(i, { columnIndex: Number(e.target.value) })}
                className="px-2 py-1.5 text-xs rounded-lg border border-border bg-column-bg text-ink outline-none"
              >
                {columns.map((c, ci) => <option key={ci} value={ci}>{c.label || `Column ${ci + 1}`}</option>)}
              </select>
              <select
                value={t.priority}
                onChange={(e) => updateTask(i, { priority: e.target.value })}
                className="px-2 py-1.5 text-xs rounded-lg border border-border bg-column-bg text-ink outline-none capitalize"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addTask} className="text-xs text-muted hover:text-ink mb-8">+ Add seed task</button>

      <div className="flex items-center gap-3 border-t border-border/60 pt-4">
        <button
          onClick={save}
          disabled={saving || columns.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-ink text-card-bg hover:opacity-95 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save preset"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
        {columns.length === 0 && <span className="text-xs text-muted">Add at least one column.</span>}
      </div>
    </div>
  );
}
