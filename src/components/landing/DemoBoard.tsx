"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import PriorityIcon from "../PriorityIcon";
import { getPriorityConfig } from "@/lib/priority";

type ColId = "todo" | "doing" | "done";

interface Tag { name: string; color: string }

interface Card {
  id: string;
  column: ColId;
  title: string;
  tags?: Tag[];
  priority: "low" | "medium" | "high" | "urgent";
  deadline?: string;
  deadlineSeverity?: "normal" | "due-soon" | "overdue";
  assignee?: { initial: string; color: string };
  notes?: number;
}

// Matches COLUMN_PALETTE indices 0, 1, 2 (blue, amber, green) — always in dark context
const COL_META: {
  id: ColId; label: string;
  bg: string; border: string; dot: string; text: string;
}[] = [
  { id: "todo",  label: "To Do",       bg: "bg-blue-950/30",  border: "border-blue-800",  dot: "bg-blue-400",  text: "text-blue-300"  },
  { id: "doing", label: "In Progress", bg: "bg-amber-950/30", border: "border-amber-800", dot: "bg-amber-400", text: "text-amber-300" },
  { id: "done",  label: "Done",        bg: "bg-green-950/30", border: "border-green-800", dot: "bg-green-400", text: "text-green-300" },
];


const INITIAL: Card[] = [
  {
    id: "c1", column: "todo", title: "Write introduction",
    tags: [{ name: "writing", color: "#8B5CF6" }],
    priority: "medium", deadline: "Jun 15", deadlineSeverity: "normal",
  },
  {
    id: "c2", column: "todo", title: "Research sources",
    tags: [{ name: "research", color: "#3B82F6" }],
    priority: "low",
  },
  {
    id: "c3", column: "todo", title: "Create outline",
    priority: "high",
  },
  {
    id: "c4", column: "doing", title: "Review literature",
    tags: [{ name: "research", color: "#3B82F6" }],
    priority: "medium", deadline: "Due in 3d", deadlineSeverity: "due-soon",
    assignee: { initial: "E", color: "#4A90A4" }, notes: 2,
  },
  {
    id: "c5", column: "doing", title: "Draft methodology",
    priority: "high",
    assignee: { initial: "R", color: "#7C3AED" },
  },
  {
    id: "c6", column: "done", title: "Define topic",
    priority: "medium",
    assignee: { initial: "A", color: "#059669" }, notes: 1,
  },
  {
    id: "c7", column: "done", title: "Form group",
    priority: "low",
  },
];

const RESET_MS = 25_000;

// ── Card visual ───────────────────────────────────────────────────────────────

function CardFace({ card, overlay }: { card: Card; overlay?: boolean }) {
  const p = card.priority;
  return (
    <div
      className="bg-card-bg rounded-2xl px-4 py-4 shadow-card border border-border/60 select-none"
      style={overlay ? {
        boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.3)",
        transform: "rotate(1.5deg) scale(1.03)",
      } : undefined}
    >
      <p className="text-sm font-medium text-ink leading-snug tracking-[-0.01em]">
        {card.title}
      </p>

      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2">
          {card.tags.map((tag) => (
            <span
              key={tag.name}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none text-ink border border-border/60"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-white">
          <PriorityIcon priority={p} className="w-3 h-3" />
          {getPriorityConfig(p).label}
        </span>

        {card.deadline && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            card.deadlineSeverity === "overdue"   ? "text-red-400"    :
            card.deadlineSeverity === "due-soon"  ? "text-orange-400" : "text-muted"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              card.deadlineSeverity === "overdue"  ? "bg-red-500"    :
              card.deadlineSeverity === "due-soon" ? "bg-orange-500" : "bg-muted/30"
            }`} />
            {card.deadline}
          </span>
        )}

        {card.assignee && (
          <>
            <span className="text-muted text-xs">·</span>
            <div
              className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: card.assignee.color }}
            >
              {card.assignee.initial}
            </div>
          </>
        )}

        {card.notes && card.notes > 0 ? (
          <>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted">
              {card.notes} {card.notes === 1 ? "note" : "notes"}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Draggable card wrapper ────────────────────────────────────────────────────

function DraggableCard({ card, nudge }: { card: Card; nudge: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div className="relative">
      {nudge && (
        <div className="absolute -top-8 right-0 z-10 pointer-events-none animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-[#161412] shadow-lg whitespace-nowrap">
            drag me →
          </span>
        </div>
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`touch-none cursor-grab active:cursor-grabbing transition-opacity ${nudge ? "animate-nudge" : ""}`}
        style={{ opacity: isDragging ? 0.2 : 1 }}
      >
        <CardFace card={card} />
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  meta, cards, isOver, nudgeId,
}: {
  meta: (typeof COL_META)[0];
  cards: Card[];
  isOver: boolean;
  nudgeId: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: meta.id });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Column header — matches ColumnHeader.tsx */}
      <div className={`flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg border ${meta.bg} ${meta.border}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
        <h2 className={`text-base font-bold tracking-wide ${meta.text} flex-1`}>{meta.label}</h2>
        <span className="text-xs text-muted font-mono bg-ink/5 rounded-md px-1.5 py-0.5">{cards.length}</span>
        <span className="text-xs text-muted">✓</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 rounded-xl transition-colors duration-200 p-2 bg-column-bg"
        style={{
          border: isOver ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
          minHeight: 160,
        }}
      >
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <DraggableCard key={card.id} card={card} nudge={card.id === nudgeId} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DemoBoard() {
  const [cards, setCards]             = useState<Card[]>(INITIAL);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [overId, setOverId]           = useState<string | null>(null);
  const [nudgeId, setNudgeId]         = useState<string | null>(null);
  const [everDragged, setEverDragged] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const scheduleReset = useCallback(() => {
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCards(INITIAL), RESET_MS);
  }, []);

  useEffect(() => {
    scheduleReset();
    return () => { if (resetRef.current) clearTimeout(resetRef.current); };
  }, [cards, scheduleReset]);

  // Nudge first card after 1.5s to hint draggability
  useEffect(() => {
    if (everDragged) return;
    const show = setTimeout(() => setNudgeId("c1"), 1500);
    const hide = setTimeout(() => setNudgeId(null),  3800);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [everDragged]);

  const activeCard = cards.find((c) => c.id === activeId);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => {
          setActiveId(e.active.id as string);
          setNudgeId(null);
          if (!everDragged) setEverDragged(true);
        }}
        onDragOver={(e) => setOverId((e.over?.id as string) ?? null)}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          setActiveId(null);
          setOverId(null);
          if (!over) return;
          const newCol = over.id as ColId;
          if (!COL_META.find((c) => c.id === newCol)) return;
          setCards((prev) => {
            const card = prev.find((c) => c.id === active.id);
            if (!card) return prev;
            return [...prev.filter((c) => c.id !== active.id), { ...card, column: newCol }];
          });
        }}
      >
        <div className="overflow-x-auto">
          <div className="flex gap-4" style={{ minWidth: 560 }}>
            {COL_META.map((meta) => (
              <Column
                key={meta.id}
                meta={meta}
                cards={cards.filter((c) => c.column === meta.id)}
                isOver={overId === meta.id}
                nudgeId={nudgeId}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 160, easing: "ease" }}>
          {activeCard ? <CardFace card={activeCard} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <p
        className="text-center text-xs mt-3 transition-opacity duration-700"
        style={{ color: "rgb(120 113 108)", opacity: everDragged ? 0 : 0.7 }}
      >
        drag cards between columns
      </p>
    </div>
  );
}
