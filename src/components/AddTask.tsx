"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  column: string;
  onAdd: (title: string, column: string) => Promise<void>;
  prominent?: boolean;
  // Bumped by a parent (e.g. the column header's "+" button) to open this
  // input from outside, no matter where it sits in a scrolled task list.
  activateSignal?: number;
}

const TITLE_CHAR_LIMIT = 200;

export default function AddTask({ column, onAdd, prominent = false, activateSignal }: Props) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleActivate = () => {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // activateSignal starts undefined/0 (falsy) so this never fires on mount --
  // only on an actual bump from the parent. Focusing the input scrolls it
  // into view automatically within its scrollable column, even if it's
  // currently below the fold.
  useEffect(() => {
    if (!activateSignal) return;
    handleActivate();
  }, [activateSignal]);

  const handleSubmit = async () => {
    // Guard against double-submit: rapid Enter presses while the first create is
    // still in flight would otherwise each fire onAdd and create duplicates.
    if (isSaving) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setIsEmpty(true);
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > TITLE_CHAR_LIMIT) {
      inputRef.current?.focus();
      return;
    }
    setIsEmpty(false);
    setSaveError(false);
    setIsSaving(true);
    try {
      await onAdd(trimmed, column);
      setValue("");
      setIsEmpty(false);
      setSaveError(false);
      setActive(false);
    } catch (err) {
      console.error("Failed to add task:", err);
      setSaveError(true);
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    if (!value.trim()) {
      setActive(false);
      setValue("");
      setIsEmpty(false);
    } else {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
      setActive(false);
      setValue("");
      setIsEmpty(false);
      setSaveError(false);
    }
  };

  if (active) {
    return (
      <div className="mt-2 motion-safe:animate-fade-in">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); if (isEmpty) setIsEmpty(false); if (saveError) setSaveError(false); }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          aria-label="Task title"
          placeholder="Task title…"
          className={`
            w-full bg-card-bg rounded-xl px-4 py-3
            text-sm text-ink placeholder:text-muted
            border focus:outline-none focus-ring
            shadow-card
            ${isEmpty || saveError ? "border-red-400" : "border-border"}
          `}
        />
        <p role="status" className={`text-xs mt-1.5 px-1 ${isEmpty || saveError || value.length > TITLE_CHAR_LIMIT ? "text-red-400" : "text-muted"}`}>
          {isSaving ? "Adding…" : saveError ? "Failed to save, try again" : isEmpty ? "Title can't be empty" : value.length > TITLE_CHAR_LIMIT ? `${value.length}/${TITLE_CHAR_LIMIT} characters, too long` : "Enter to add · Esc to cancel"}
        </p>
      </div>
    );
  }

  if (prominent) {
    return (
      <button
        onClick={handleActivate}
        className="mt-3 w-full px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-ink/30 hover:bg-card-bg text-sm text-muted hover:text-ink transition-all duration-150 flex items-center justify-center gap-2"
      >
        <span className="text-base leading-none">+</span>
        <span>Add your first task</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleActivate}
      className="
        mt-2 w-full text-left px-4 py-2.5 rounded-xl
        text-sm text-muted hover:text-ink
        hover:bg-card-bg
        transition-colors duration-100
        flex items-center gap-2
      "
    >
      <span className="text-base leading-none">+</span>
      <span>Add task</span>
    </button>
  );
}
