"use client";

import React, { useCallback, useEffect, useState } from "react";

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

// Properties copied onto the hidden mirror element so its text wraps exactly
// like the textarea — that's how we locate a selection's pixel position.
const MIRROR_PROPS = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
  "borderLeftWidth", "borderStyle", "paddingTop", "paddingRight", "paddingBottom",
  "paddingLeft", "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
  "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent",
  "letterSpacing", "wordSpacing", "tabSize",
] as const;

// Pixel coordinates of a caret position within the textarea's content box.
function caretCoords(el: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const style = window.getComputedStyle(el);
  const div = document.createElement("div");
  const src = style as unknown as Record<string, string>;
  const dst = div.style as unknown as Record<string, string>;
  for (const prop of MIRROR_PROPS) {
    dst[prop] = src[prop];
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflow = "hidden";
  div.style.top = "0";
  div.style.left = "-9999px";

  div.textContent = el.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = el.value.slice(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const top = span.offsetTop + parseInt(style.borderTopWidth || "0", 10);
  const left = span.offsetLeft + parseInt(style.borderLeftWidth || "0", 10);
  document.body.removeChild(div);
  return { top, left };
}

const TOOLBAR_H = 38;

export default function MarkdownToolbar({ textareaRef, value, onChange }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const update = useCallback(() => {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      setPos(null);
      return;
    }
    const start = caretCoords(el, el.selectionStart);
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
    const caretTop = start.top - el.scrollTop;
    const above = caretTop - TOOLBAR_H - 6;
    // Flip below the line if there isn't room above.
    const top = above >= 0 ? above : caretTop + lineHeight + 6;
    const left = Math.max(0, Math.min(start.left - el.scrollLeft, el.clientWidth - 150));
    setPos({ top, left });
  }, [textareaRef]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onSelect = () => update();
    const onBlur = () => setPos(null);
    el.addEventListener("select", onSelect);
    el.addEventListener("mouseup", onSelect);
    el.addEventListener("keyup", onSelect);
    el.addEventListener("scroll", onSelect);
    el.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("select", onSelect);
      el.removeEventListener("mouseup", onSelect);
      el.removeEventListener("keyup", onSelect);
      el.removeEventListener("scroll", onSelect);
      el.removeEventListener("blur", onBlur);
    };
  }, [textareaRef, update]);

  const wrap = useCallback(
    (marker: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) return;

      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const after = value.slice(end);

      // Toggle: strip the marker if the selection is already wrapped in it.
      // Also check the character just outside the boundary isn't the same character
      // (e.g. "*" italic toggle on "**bold**" would otherwise false-positive).
      const charBefore = before[before.length - marker.length - 1];
      const charAfter = after[marker.length];
      const wrapped =
        before.endsWith(marker) &&
        after.startsWith(marker) &&
        charBefore !== marker[0] &&
        charAfter !== marker[marker.length - 1];
      let next: string;
      let ns: number;
      let ne: number;
      if (wrapped) {
        next = before.slice(0, before.length - marker.length) + selected + after.slice(marker.length);
        ns = start - marker.length;
        ne = end - marker.length;
      } else {
        next = `${before}${marker}${selected}${marker}${after}`;
        ns = start + marker.length;
        ne = end + marker.length;
      }

      onChange(next);
      // Restore the selection after React re-renders the textarea.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(ns, ne);
        update();
      });
    },
    [textareaRef, value, onChange, update]
  );

  if (!pos) return null;

  const buttons: { marker: string; label: string; node: React.ReactNode }[] = [
    { marker: "**", label: "Bold", node: <span className="font-bold">B</span> },
    { marker: "*", label: "Italic", node: <span className="italic font-serif">I</span> },
    { marker: "++", label: "Underline", node: <span className="underline">U</span> },
    { marker: "~~", label: "Strikethrough", node: <span className="line-through">S</span> },
    { marker: "`", label: "Code", node: <span className="font-mono text-[13px]">{"<>"}</span> },
  ];

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border bg-card-bg shadow-modal px-1 py-1"
      style={{ top: pos.top, left: pos.left }}
      // Keep selection/focus in the textarea when interacting with the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="Text formatting"
    >
      {buttons.map((b) => (
        <button
          key={b.marker}
          type="button"
          title={b.label}
          aria-label={b.label}
          onMouseDown={(e) => {
            e.preventDefault();
            wrap(b.marker);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-sm text-ink/80 hover:text-ink hover:bg-column-bg transition-colors"
        >
          {b.node}
        </button>
      ))}
    </div>
  );
}
