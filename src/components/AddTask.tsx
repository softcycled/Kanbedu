"use client";

import { useState, useRef } from "react";

interface Props {
  column: string;
  onAdd: (title: string, column: string) => Promise<void>;
}

export default function AddTask({ column, onAdd }: Props) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleActivate = () => {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setActive(false);
      setValue("");
      return;
    }
    setValue("");
    setActive(false);
    await onAdd(trimmed, column);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
      setActive(false);
      setValue("");
    }
  };

  if (active) {
    return (
      <div className="mt-2 animate-fade-in">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          placeholder="Task title…"
          className="
            w-full bg-card-bg rounded-xl px-4 py-3
            text-sm text-ink placeholder:text-muted
            border border-border focus:border-ink/20 focus:outline-none
            shadow-card
          "
        />
        <p className="text-xs text-muted mt-1.5 px-1">Enter to add · Esc to cancel</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleActivate}
      className="
        mt-2 w-full text-left px-4 py-2.5 rounded-xl
        text-sm text-muted hover:text-ink
        hover:bg-black/5
        transition-colors duration-100
        flex items-center gap-2
      "
    >
      <span className="text-base leading-none">+</span>
      <span>Add task</span>
    </button>
  );
}
