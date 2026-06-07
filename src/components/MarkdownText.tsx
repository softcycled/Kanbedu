"use client";

import React from "react";

// Discord-flavored markdown rendering for a small, well-defined marker set.
// Display-only: the raw text is what's stored/edited, so history and diffs are
// unaffected. Supported inline markers (longest first so ** isn't read as two *):
//   ***x*** bold+italic · **x** bold · __x__ underline · ~~x~~ strikethrough · *x* italic
// Line markers: leading #, ##, ### → headers. Markers nest/combine via recursion.

type Rule = { delim: string; render: (children: React.ReactNode, key: string) => React.ReactNode };

const INLINE_RULES: Rule[] = [
  { delim: "***", render: (c, k) => <strong key={k} className="font-semibold"><em>{c}</em></strong> },
  { delim: "**", render: (c, k) => <strong key={k} className="font-semibold">{c}</strong> },
  { delim: "__", render: (c, k) => <span key={k} className="underline">{c}</span> },
  { delim: "~~", render: (c, k) => <span key={k} className="line-through">{c}</span> },
  { delim: "*", render: (c, k) => <em key={k}>{c}</em> },
];

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let plainStart = 0;
  let k = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-t${k++}`}>{text.slice(plainStart, end)}</React.Fragment>
      );
    }
  };

  while (i < text.length) {
    let matched: { rule: Rule; close: number } | null = null;
    for (const rule of INLINE_RULES) {
      if (text.startsWith(rule.delim, i)) {
        // Closing delimiter must leave at least one inner character.
        const close = text.indexOf(rule.delim, i + rule.delim.length);
        if (close > i + rule.delim.length) {
          matched = { rule, close };
          break;
        }
      }
    }

    if (matched) {
      pushPlain(i);
      const inner = text.slice(i + matched.rule.delim.length, matched.close);
      const key = `${keyPrefix}-m${k++}`;
      nodes.push(matched.rule.render(parseInline(inner, key), key));
      i = matched.close + matched.rule.delim.length;
      plainStart = i;
    } else {
      i++;
    }
  }

  pushPlain(text.length);
  return nodes;
}

function renderLine(line: string, key: string): React.ReactNode {
  const header = /^(#{1,3})\s+(.*)$/.exec(line);
  if (header) {
    const level = header[1].length;
    const cls =
      level === 1 ? "text-xl font-bold" : level === 2 ? "text-lg font-bold" : "text-base font-semibold";
    return (
      <div key={key} className={`${cls} text-ink mt-1.5 mb-0.5 first:mt-0`}>
        {parseInline(header[2], key)}
      </div>
    );
  }
  if (line.trim() === "") {
    return <div key={key} className="h-3" aria-hidden />;
  }
  return (
    <div key={key} className="whitespace-pre-wrap break-words">
      {parseInline(line, key)}
    </div>
  );
}

export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return <div className={className}>{lines.map((line, i) => renderLine(line, `l${i}`))}</div>;
}
