"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Skeleton from "../Skeleton";
import SharedAvatar from "../Avatar";
import SearchIcon from "../SearchIcon";
import { matchesGroupName, findGroupSuggestion } from "@/lib/groupSearch";

interface ParticipationMember {
  userId: string;
  name: string;
  handle: string | null;
  color: string;
  descWordsAdded: number;
  descEdits: number;
  commentCount: number;
  commentWords: number;
}

interface ParticipationGroup {
  groupId: string;
  name: string;
  boardId: string;
  members: ParticipationMember[];
}

interface Props {
  classId: string;
  onOpenBoard: (g: { id: string; name: string; boardId: string }) => void;
  reloadSignal?: number;
}

type SortKey = "total" | "desc" | "comments" | "alpha";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MemberRow({
  member,
  maxDescWords,
  maxCommentWords,
}: {
  member: ParticipationMember;
  maxDescWords: number;
  maxCommentWords: number;
}) {
  const total = member.descWordsAdded + member.commentWords;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <SharedAvatar name={member.name || member.handle} color={member.color} size="md" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-ink truncate">{member.name || member.handle || "Unknown"}</span>
          <span className="text-xs text-muted flex-shrink-0">{total.toLocaleString()} words total</span>
        </div>

        {/* Description row */}
        <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2 mb-1.5">
          <span className="text-[11px] text-muted">Description</span>
          <Bar value={member.descWordsAdded} max={maxDescWords} color="bg-blue-400/70 dark:bg-blue-500/60" />
          <span className="text-[11px] text-ink/70 w-28 text-right flex-shrink-0">
            {member.descWordsAdded.toLocaleString()} words
            {member.descEdits > 0 && (
              <span className="text-muted ml-1">({member.descEdits} {member.descEdits === 1 ? "edit" : "edits"})</span>
            )}
          </span>
        </div>

        {/* Comments row */}
        <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
          <span className="text-[11px] text-muted">Comments</span>
          <Bar value={member.commentWords} max={maxCommentWords} color="bg-emerald-400/70 dark:bg-emerald-500/60" />
          <span className="text-[11px] text-ink/70 w-28 text-right flex-shrink-0">
            {member.commentWords.toLocaleString()} words
            {member.commentCount > 0 && (
              <span className="text-muted ml-1">({member.commentCount} {member.commentCount === 1 ? "comment" : "comments"})</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  sortKey,
  onOpenBoard,
}: {
  group: ParticipationGroup;
  sortKey: SortKey;
  onOpenBoard: Props["onOpenBoard"];
}) {
  const sorted = [...group.members].sort((a, b) => {
    if (sortKey === "alpha") return a.name.localeCompare(b.name);
    if (sortKey === "desc") return b.descWordsAdded - a.descWordsAdded;
    if (sortKey === "comments") return b.commentWords - a.commentWords;
    return (b.descWordsAdded + b.commentWords) - (a.descWordsAdded + a.commentWords);
  });

  const maxDescWords = Math.max(...group.members.map((m) => m.descWordsAdded), 1);
  const maxCommentWords = Math.max(...group.members.map((m) => m.commentWords), 1);
  const totalWords = group.members.reduce((s, m) => s + m.descWordsAdded + m.commentWords, 0);

  return (
    <div className="bg-card-bg border border-border/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-ink truncate">{group.name}</span>
          <span className="text-xs text-muted flex-shrink-0">{totalWords.toLocaleString()} words across group</span>
        </div>
        <button
          onClick={() => onOpenBoard({ id: group.groupId, name: group.name, boardId: group.boardId })}
          className="text-xs text-muted hover:text-ink transition-colors flex-shrink-0 ml-3"
        >
          View board
        </button>
      </div>

      {group.members.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No members in this group yet.</p>
      ) : (
        <div className="px-5">
          {sorted.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              maxDescWords={maxDescWords}
              maxCommentWords={maxCommentWords}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParticipationPanel({ classId, onOpenBoard, reloadSignal }: Props) {
  const [groups, setGroups] = useState<ParticipationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [search, setSearch] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/participation`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to load participation.");
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (e: any) {
      if (!silent) setError(e?.message || "Failed to load participation.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const skipFirstReload = useRef(true);
  useEffect(() => {
    if (reloadSignal === undefined) return;
    if (skipFirstReload.current) { skipFirstReload.current = false; return; }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  useEffect(() => {
    if (!search) { setSuggestion(null); return; }
    const names = groups.map((g) => g.name);
    const visibleNames = new Set(names.filter((n) => matchesGroupName(search, n)));
    setSuggestion(findGroupSuggestion(names, search, visibleNames));
  }, [search, groups]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl space-y-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted">
        <p>{error}</p>
        <button onClick={() => load()} className="text-xs underline">Retry</button>
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted px-6 text-center">
        No groups yet. Create groups in the Roster tab first.
      </div>
    );
  }

  const filtered = groups.filter((g) =>
    !search || matchesGroupName(search, g.name)
  );

  const totalGroupWords = groups.reduce(
    (sum, g) => sum + g.members.reduce((s, m) => s + m.descWordsAdded + m.commentWords, 0),
    0
  );
  const totalComments = groups.reduce(
    (sum, g) => sum + g.members.reduce((s, m) => s + m.commentCount, 0),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 md:px-10 py-6 max-w-4xl space-y-5">

        {/* Summary bar */}
        <div className="flex items-center gap-6 text-sm text-muted">
          <span><span className="font-semibold text-ink">{totalGroupWords.toLocaleString()}</span> words written</span>
          <span><span className="font-semibold text-ink">{totalComments.toLocaleString()}</span> comments</span>
          <span><span className="font-semibold text-ink">{groups.length}</span> {groups.length === 1 ? "group" : "groups"}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-column-bg border border-border text-sm text-ink placeholder:text-muted outline-none focus:ring-1 focus:ring-border"
            />
          </div>

          <div className="flex items-center gap-1 bg-column-bg border border-border rounded-lg p-0.5 text-xs">
            {([
              { key: "total", label: "Total" },
              { key: "desc", label: "Descriptions" },
              { key: "comments", label: "Comments" },
              { key: "alpha", label: "A-Z" },
            ] as { key: SortKey; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortKey === opt.key
                    ? "bg-ink text-paper font-medium"
                    : "text-muted hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {suggestion && !filtered.length && (
          <p className="text-sm text-muted">
            No results for &ldquo;{search}&rdquo;.{" "}
            <button className="underline" onClick={() => setSearch(suggestion)}>
              Did you mean &ldquo;{suggestion}&rdquo;?
            </button>
          </p>
        )}

        {filtered.map((g) => (
          <GroupCard key={g.groupId} group={g} sortKey={sortKey} onOpenBoard={onOpenBoard} />
        ))}
      </div>
    </div>
  );
}
