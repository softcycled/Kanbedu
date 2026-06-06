"use client";

import { useState, useEffect, useRef } from "react";
import PriorityIcon from "../PriorityIcon";

// ── Visual mockups — match the real app's design language ─────────────────────

function CreateClassVisual() {
  return (
    <div className="bg-card-bg rounded-2xl shadow-modal w-full p-6 border border-border/70">
      <h2 className="text-lg font-semibold text-ink">Create class</h2>
      <p className="text-xs text-muted mt-1">You'll be the educator and can set up groups and a preset.</p>
      <div className="mt-4 space-y-2">
        <input
          readOnly
          value="Biology 101"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none"
        />
        <input
          readOnly
          value="Spring 2026"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-column-bg text-ink outline-none"
        />
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button className="px-3 py-1.5 rounded-lg text-sm text-muted">Back</button>
        <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary">
          Create
        </button>
      </div>
    </div>
  );
}

const LOBBY_STUDENTS = [
  { color: "#4A90A4", name: "Emma Chen",  group: null       },
  { color: "#7C3AED", name: "Raj Patel",  group: "Group 1"  },
  { color: "#059669", name: "Sofia Lee",  group: "Group 1"  },
  { color: "#D97706", name: "James K.",   group: null       },
  { color: "#DB2777", name: "Mia Torres", group: "Group 2"  },
];

function Chip({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card-bg border border-border/70">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {name.charAt(0)}
      </span>
      <span className="text-xs text-ink">{name}</span>
    </div>
  );
}

function InviteVisual() {
  return (
    <div className="bg-card-bg rounded-2xl shadow-modal w-full p-6 border border-border/70">
      <h3 className="text-sm font-semibold text-ink mb-1">Class Invite</h3>
      <p className="text-xs text-muted mb-3">
        Share this link. Students join the lobby, then you sort them into groups.
      </p>
      <div className="flex items-center gap-2 mb-6">
        <input
          readOnly
          value="kanbedu.com/class/join/bio-2026"
          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-column-bg text-ink/80 outline-none"
        />
        <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary">
          Copy
        </button>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/60 mb-2">
        Lobby (2 unassigned)
      </p>
      <div className="flex flex-wrap gap-2">
        {LOBBY_STUDENTS.filter((s) => !s.group).map((s) => (
          <Chip key={s.name} color={s.color} name={s.name} />
        ))}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/60 mb-2 mt-4">
        Group 1
      </p>
      <div className="flex flex-wrap gap-2">
        {LOBBY_STUDENTS.filter((s) => s.group === "Group 1").map((s) => (
          <Chip key={s.name} color={s.color} name={s.name} />
        ))}
      </div>
    </div>
  );
}

const GROUP_COLS = [
  {
    id: "todo", label: "To Do",
    bg: "bg-blue-950/30", border: "border-blue-800", dot: "bg-blue-400", text: "text-blue-300",
    cards: [
      { title: "Write intro",    tag: { name: "writing",  color: "#8B5CF6" }, priority: "medium" as const },
      { title: "Create outline", priority: "high" as const },
    ],
  },
  {
    id: "doing", label: "In Progress",
    bg: "bg-amber-950/30", border: "border-amber-800", dot: "bg-amber-400", text: "text-amber-300",
    cards: [
      { title: "Literature review", tag: { name: "research", color: "#3B82F6" }, priority: "medium" as const, assignee: { initial: "E", color: "#4A90A4" } },
    ],
  },
  {
    id: "done", label: "Done",
    bg: "bg-green-950/30", border: "border-green-800", dot: "bg-green-400", text: "text-green-300",
    cards: [
      { title: "Form team",  priority: "low" as const,    assignee: { initial: "R", color: "#7C3AED" } },
      { title: "Pick topic", priority: "medium" as const },
    ],
  },
];

function GroupBoardVisual() {
  return (
    <div className="rounded-2xl border border-border/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2 bg-card-bg">
        <span className="text-sm font-semibold text-ink">Group B</span>
        <span className="text-border">·</span>
        <span className="text-xs text-muted">Biology 101</span>
      </div>
      <div className="flex gap-2 p-3 bg-paper">
        {GROUP_COLS.map((col) => (
          <div key={col.id} className="flex-1 flex flex-col min-w-0">
            <div className={`flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg border ${col.bg} ${col.border}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
              <span className={`text-[11px] font-bold tracking-wide ${col.text} flex-1`}>{col.label}</span>
              <span className="text-[10px] text-muted font-mono bg-ink/5 rounded px-1 py-0.5">{col.cards.length}</span>
            </div>
            <div className="flex-1 rounded-xl p-2 bg-column-bg" style={{ minHeight: 90 }}>
              <div className="flex flex-col gap-2">
                {col.cards.map((card) => (
                  <div key={card.title} className="bg-card-bg rounded-2xl px-3 py-3 border border-border/60">
                    <p className="text-[11px] font-medium text-ink leading-snug">{card.title}</p>
                    {"tag" in card && card.tag && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-ink border border-border/60">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: card.tag.color }} />
                          {card.tag.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white">
                        <PriorityIcon priority={card.priority} className="w-2.5 h-2.5" />
                        {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
                      </span>
                      {"assignee" in card && card.assignee && (
                        <>
                          <span className="text-muted text-[10px]">·</span>
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: card.assignee.color }}
                          >
                            {card.assignee.initial}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MONITOR_GROUPS = [
  { name: "Group 1", done: 4, total: 9,  pct: 44, cols: [{ l: "To Do", n: 3 }, { l: "In Progress", n: 2 }, { l: "Done", n: 4 }], colors: ["#4A90A4", "#7C3AED"], attention: false },
  { name: "Group 2", done: 3, total: 7,  pct: 43, cols: [{ l: "To Do", n: 1 }, { l: "In Progress", n: 3 }, { l: "Done", n: 3 }], colors: ["#059669", "#D97706"], attention: false },
  { name: "Group 3", done: 2, total: 7,  pct: 29, cols: [{ l: "To Do", n: 4 }, { l: "In Progress", n: 1 }, { l: "Done", n: 2 }], colors: ["#DB2777", "#4A90A4"], attention: true  },
  { name: "Group 4", done: 5, total: 9,  pct: 56, cols: [{ l: "To Do", n: 2 }, { l: "In Progress", n: 2 }, { l: "Done", n: 5 }], colors: ["#7C3AED", "#059669"], attention: false },
];

function MonitorVisual() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted">
          Each group's own progress. Not a ranking.
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MONITOR_GROUPS.map((g) => (
          <div
            key={g.name}
            className={`text-left rounded-2xl border bg-card-bg p-4 ${
              g.attention ? "border-orange-800" : "border-border/70"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{g.name}</h3>
              <span className="text-xs text-muted">{g.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink/8 overflow-hidden">
              <div className="h-full rounded-full bg-ink/60" style={{ width: `${g.pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">{g.done} of {g.total} tasks done</p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {g.cols.map((c) => (
                <span key={c.l} className="text-[10px] px-1.5 py-0.5 rounded bg-ink/5 text-ink/70">
                  {c.l} {c.n}
                </span>
              ))}
            </div>
            <div className="mt-3 flex -space-x-1.5">
              {g.colors.map((color, i) => (
                <span
                  key={i}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-white ring-2 ring-card-bg"
                  style={{ backgroundColor: color }}
                >
                  {["E","R","S","J","M","A"][i * 2] ?? "?"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Create a class",
    body: "Set up your class in seconds. Give it a name, add a term, and you're ready.",
    Visual: CreateClassVisual,
  },
  {
    num: "02",
    title: "Invite students, form groups",
    body: "Share the invite link. Students land in the lobby. Drag them into groups and each group gets their own board.",
    Visual: InviteVisual,
  },
  {
    num: "03",
    title: "Groups get to work",
    body: "Each group sees only their own board. They manage tasks, move cards, and collaborate at their own pace.",
    Visual: GroupBoardVisual,
  },
  {
    num: "04",
    title: "You see everything",
    body: "The monitor shows all groups' progress live. Spot who's stuck and where to step in. No ranking, just help signals.",
    Visual: MonitorVisual,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EducatorSteps() {
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || manual) return;
    const id = setInterval(() => setActive((p) => (p + 1) % STEPS.length), 4000);
    return () => clearInterval(id);
  }, [visible, manual]);

  return (
    <div ref={rootRef} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
      {/* Left: step list */}
      <div className="space-y-1">
        {STEPS.map((step, i) => (
          <button
            key={step.num}
            onClick={() => { setActive(i); setManual(true); }}
            className="w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200"
            style={{
              background: active === i ? "rgb(var(--c-column-bg))" : "transparent",
              border: `1px solid ${active === i ? "rgb(var(--c-border))" : "transparent"}`,
            }}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 transition-all duration-200"
              style={{
                background: active === i ? "rgb(var(--c-accent))" : "rgb(var(--c-column-bg))",
                color:      active === i ? "white"                 : "rgb(var(--c-muted))",
                border:     active === i ? "none"                  : "1px solid rgb(var(--c-border))",
              }}
            >
              {step.num}
            </span>
            <div className="min-w-0">
              <h4
                className="text-sm font-semibold transition-colors duration-200"
                style={{ color: active === i ? "rgb(var(--c-ink))" : "rgb(var(--c-muted))" }}
              >
                {step.title}
              </h4>
              <p
                className="text-xs text-muted leading-relaxed"
                style={{
                  maxHeight: active === i ? "80px" : "0",
                  overflow: "hidden",
                  opacity: active === i ? 1 : 0,
                  marginTop: active === i ? "4px" : "0",
                  transition: "max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease",
                }}
              >
                {step.body}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Right: visual */}
      <div className="relative h-[400px]">
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: active === i ? 1 : 0,
              pointerEvents: active === i ? "auto" : "none",
            }}
          >
            <step.Visual />
          </div>
        ))}
      </div>
    </div>
  );
}
