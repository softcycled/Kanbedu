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
    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
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
    <li className="px-5 py-3 flex items-start gap-3 border-b border-border/50 last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <SharedAvatar name={member.name || member.handle} color={member.color} size="md" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-ink truncate">{member.name || member.handle || "Unknown"}</span>
          <span className="text-xs text-muted flex-shrink-0">{total.toLocaleString()} words total</span>
        </div>
        <div className="grid grid-cols-[72px_1fr_auto] items-center gap-2 mb-1.5">
          <span className="text-[11px] text-muted">Description</span>
          <Bar value={member.descWordsAdded} max={maxDescWords} color="bg-blue-400/70 dark:bg-blue-500/60" />
          <span className="text-[11px] text-ink/70 w-28 text-right flex-shrink-0">
            {member.descWordsAdded.toLocaleString()} words
            {member.descEdits > 0 && (
              <span className="text-muted ml-1">({member.descEdits} {member.descEdits === 1 ? "edit" : "edits"})</span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
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
    </li>
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
    <section className="rounded-2xl border border-border/70 bg-card-bg">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-ink truncate">{group.name}</h3>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-ink/8 text-muted flex-shrink-0">
            {totalWords.toLocaleString()} words
          </span>
        </div>
        <button
          onClick={() => onOpenBoard({ id: group.groupId, name: group.name, boardId: group.boardId })}
          className="text-sm text-muted hover:text-ink transition-colors flex-shrink-0"
        >
          Open board
        </button>
      </div>
      {group.members.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No members in this group yet.</p>
      ) : (
        <ul>
          {sorted.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              maxDescWords={maxDescWords}
              maxCommentWords={maxCommentWords}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ParticipationPanel({ classId, onOpenBoard, reloadSignal }: Props) {
  const [groups, setGroups] = useState<ParticipationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [search, setSearch] = useState("");

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

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
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

  const searchTrimmed = search.trim();
  const filtered = groups.filter((g) => !searchTrimmed || matchesGroupName(searchTrimmed, g.name));
  const groupSuggestion = searchTrimmed
    ? findGroupSuggestion(groups.map((g) => g.name), searchTrimmed, new Set(filtered.map((g) => g.name)))
    : null;

  const totalWords = groups.reduce((s, g) => s + g.members.reduce((ms, m) => ms + m.descWordsAdded + m.commentWords, 0), 0);
  const totalComments = groups.reduce((s, g) => s + g.members.reduce((ms, m) => ms + m.commentCount, 0), 0);

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl">
      {/* Description + stats */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <p className="text-xs text-muted max-w-xl">
          Words written to card descriptions and comments, per member.
          Descriptions count only new words added per save. Edits that remove text do not subtract.
          Comments are matched to board members by their display name.
        </p>
        <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted">
          <span><span className="font-semibold text-ink">{totalWords.toLocaleString()}</span> words</span>
          <span><span className="font-semibold text-ink">{totalComments.toLocaleString()}</span> comments</span>
        </div>
      </div>

      {/* Sort pills + search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "total", label: "Total" },
            { key: "desc", label: "Descriptions" },
            { key: "comments", label: "Comments" },
            { key: "alpha", label: "A–Z" },
          ] as { key: SortKey; label: string }[]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                sortKey === opt.key
                  ? "bg-ink text-paper"
                  : "bg-ink/8 text-ink/70 hover:bg-ink/12 hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <SearchIcon />
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups…"
                className="w-36 bg-ink/5 border border-border/60 hover:border-border focus:border-ink/30 focus:bg-column-bg rounded-lg pl-9 pr-3 py-1 text-sm text-ink placeholder:text-muted outline-none transition-colors"
              />
            </div>
            {groupSuggestion && (
              <button
                onClick={() => setSearch(groupSuggestion)}
                className="text-[11px] text-muted hover:text-ink transition-colors"
              >
                Did you mean <span className="font-medium underline">{groupSuggestion}</span>?
              </button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-4">No groups match this search.</p>
      ) : (
        <div className="space-y-5">
          {filtered.map((g) => (
            <GroupCard key={g.groupId} group={g} sortKey={sortKey} onOpenBoard={onOpenBoard} />
          ))}
        </div>
      )}
    </div>
  );
}
