import { useEffect, useState } from "react";
import type { BoardMemberData, Tag } from "@/lib/types";

// In-memory caches and in-flight dedupe maps
const membersCache = new Map<string, BoardMemberData[]>();
const tagsCache = new Map<string, Tag[]>();
const inFlightMembers = new Map<string, Promise<BoardMemberData[]>>();
const inFlightTags = new Map<string, Promise<Tag[]>>();

// Simple pub-sub so multiple hook instances stay in sync
const membersListeners = new Map<string, Set<(v: BoardMemberData[]) => void>>();
const tagsListeners = new Map<string, Set<(v: Tag[]) => void>>();

async function fetchMembersForBoard(boardId: string): Promise<BoardMemberData[]> {
  if (!boardId) return [];
  if (membersCache.has(boardId)) return membersCache.get(boardId)!;
  if (inFlightMembers.has(boardId)) return inFlightMembers.get(boardId)!;

  const p = fetch(`/api/boards/${boardId}/members`)
    .then((r) => (r.ok ? r.json() : []))
    .then((data: BoardMemberData[]) => {
      membersCache.set(boardId, data || []);
      const set = membersListeners.get(boardId);
      if (set) for (const fn of set) fn(membersCache.get(boardId)!);
      return membersCache.get(boardId)!;
    })
    .finally(() => inFlightMembers.delete(boardId));

  inFlightMembers.set(boardId, p);
  return p;
}

async function fetchTagsForBoard(boardId: string): Promise<Tag[]> {
  if (!boardId) return [];
  if (tagsCache.has(boardId)) return tagsCache.get(boardId)!;
  if (inFlightTags.has(boardId)) return inFlightTags.get(boardId)!;

  const p = fetch(`/api/tags?boardId=${boardId}`)
    .then((r) => (r.ok ? r.json() : []))
    .then((data: Tag[]) => {
      tagsCache.set(boardId, data || []);
      const set = tagsListeners.get(boardId);
      if (set) for (const fn of set) fn(tagsCache.get(boardId)!);
      return tagsCache.get(boardId)!;
    })
    .finally(() => inFlightTags.delete(boardId));

  inFlightTags.set(boardId, p);
  return p;
}

export function useBoardResources(boardId: string | null) {
  const id = boardId ?? "";
  const [members, setMembers] = useState<BoardMemberData[]>(() => (boardId && membersCache.has(id) ? membersCache.get(id)! : []));
  const [tags, setTags] = useState<Tag[]>(() => (boardId && tagsCache.has(id) ? tagsCache.get(id)! : []));
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (!boardId) {
      setMembers([]);
      setTags([]);
      return;
    }

    // Initialize from cache synchronously when available
    if (membersCache.has(id)) setMembers(membersCache.get(id)!);
    if (tagsCache.has(id)) setTags(tagsCache.get(id)!);

    // Register listeners so other hook instances are notified
    const mSet = membersListeners.get(id) ?? new Set();
    mSet.add(setMembers);
    membersListeners.set(id, mSet);
    const tSet = tagsListeners.get(id) ?? new Set();
    tSet.add(setTags);
    tagsListeners.set(id, tSet);

    let cancelled = false;
    (async () => {
      if (!membersCache.has(id)) {
        setLoadingMembers(true);
        const m = await fetchMembersForBoard(id).catch(() => []);
        if (!cancelled) setMembers(m);
        setLoadingMembers(false);
      }
      if (!tagsCache.has(id)) {
        setLoadingTags(true);
        const t = await fetchTagsForBoard(id).catch(() => []);
        if (!cancelled) setTags(t);
        setLoadingTags(false);
      }
    })();

    return () => {
      cancelled = true;
      const ml = membersListeners.get(id);
      if (ml) {
        ml.delete(setMembers);
        if (ml.size === 0) membersListeners.delete(id);
      }
      const tl = tagsListeners.get(id);
      if (tl) {
        tl.delete(setTags);
        if (tl.size === 0) tagsListeners.delete(id);
      }
    };
  }, [boardId]);

  const reloadMembers = async () => {
    if (!boardId) return;
    membersCache.delete(id);
    setLoadingMembers(true);
    const m = await fetchMembersForBoard(id).catch(() => []);
    setMembers(m);
    setLoadingMembers(false);
  };

  const reloadTags = async () => {
    if (!boardId) return;
    tagsCache.delete(id);
    setLoadingTags(true);
    const t = await fetchTagsForBoard(id).catch(() => []);
    setTags(t);
    setLoadingTags(false);
  };

  const setMembersForBoard = (updater: BoardMemberData[] | ((prev: BoardMemberData[]) => BoardMemberData[])) => {
    if (!boardId) return;
    const prev = membersCache.get(id) ?? [];
    const next = typeof updater === "function" ? (updater as (p: BoardMemberData[]) => BoardMemberData[])(prev) : updater;
    membersCache.set(id, next);
    const set = membersListeners.get(id);
    if (set) for (const fn of set) fn(next);
  };

  const setTagsForBoard = (updater: Tag[] | ((prev: Tag[]) => Tag[])) => {
    if (!boardId) return;
    const prev = tagsCache.get(id) ?? [];
    const next = typeof updater === "function" ? (updater as (p: Tag[]) => Tag[])(prev) : updater;
    tagsCache.set(id, next);
    const set = tagsListeners.get(id);
    if (set) for (const fn of set) fn(next);
  };

  return {
    members,
    tags,
    loadingMembers,
    loadingTags,
    reloadMembers,
    reloadTags,
    setMembersForBoard,
    setTagsForBoard,
  };
}

export default useBoardResources;
