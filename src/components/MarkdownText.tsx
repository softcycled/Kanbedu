"use client";

import React from "react";

// Discord-flavored markdown rendering.
// Inline: ***bold+italic*** · **bold** · ++underline++ · ~~strikethrough~~ · *italic* · `code`
// Block:  # / ## / ### headings · ``` fences · > blockquotes · - / * lists

type InlineRule = { delim: string; render: (children: React.ReactNode, key: string) => React.ReactNode };

const INLINE_RULES: InlineRule[] = [
  { delim: "***", render: (c, k) => <strong key={k} className="font-semibold"><em>{c}</em></strong> },
  { delim: "**",  render: (c, k) => <strong key={k} className="font-semibold">{c}</strong> },
  { delim: "++",  render: (c, k) => <span key={k} className="underline">{c}</span> },
  { delim: "~~",  render: (c, k) => <span key={k} className="line-through">{c}</span> },
  { delim: "*",   render: (c, k) => <em key={k}>{c}</em> },
];

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let plainStart = 0;
  let k = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) nodes.push(
      <React.Fragment key={`${keyPrefix}-t${k++}`}>{text.slice(plainStart, end)}</React.Fragment>
    );
  };

  while (i < text.length) {
    // Inline code — no nested markdown inside backtick spans.
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close > i + 1) {
        pushPlain(i);
        nodes.push(
          <code key={`${keyPrefix}-c${k++}`} className="bg-column-bg px-1 py-0.5 rounded font-mono text-[0.875em]">
            {text.slice(i + 1, close)}
          </code>
        );
        i = close + 1;
        plainStart = i;
        continue;
      }
    }

    let matched: { rule: InlineRule; close: number } | null = null;
    for (const rule of INLINE_RULES) {
      if (text.startsWith(rule.delim, i)) {
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

// ── Block-level parsing ──────────────────────────────────────────────────────

type Block =
  | { type: "fence"; code: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "list"; items: string[] }
  | { type: "lines"; lines: string[] };

function groupBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence ```
    if (line.trimStart().startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({ type: "fence", code: codeLines.join("\n") });
      continue;
    }

    // Blockquote >
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i] === ">" ? "" : lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Unordered list: - item or * item (asterisk+space, not bold)
    if (/^[*-] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Regular lines — accumulate until a block-level construct starts
    const plainLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].startsWith("> ") &&
      lines[i] !== ">" &&
      !/^[*-] /.test(lines[i])
    ) {
      plainLines.push(lines[i]);
      i++;
    }
    if (plainLines.length > 0) blocks.push({ type: "lines", lines: plainLines });
  }

  return blocks;
}

function renderSingleLine(line: string, key: string): React.ReactNode {
  const header = /^(#{1,3})\s+(.*)$/.exec(line);
  if (header) {
    const level = header[1].length;
    const cls = level === 1 ? "text-xl font-bold" : level === 2 ? "text-lg font-bold" : "text-base font-semibold";
    return (
      <div key={key} className={`${cls} text-ink mt-1.5 mb-0.5 first:mt-0`}>
        {parseInline(header[2], key)}
      </div>
    );
  }
  if (line.trim() === "") return <div key={key} className="h-3" aria-hidden />;
  return (
    <div key={key} className="whitespace-pre-wrap break-words">
      {parseInline(line, key)}
    </div>
  );
}

function renderBlock(block: Block, bk: string): React.ReactNode {
  switch (block.type) {
    case "fence":
      return (
        <pre key={bk} className="bg-column-bg rounded-lg px-4 py-3 my-2 overflow-x-auto text-[0.875em] font-mono whitespace-pre">
          <code>{block.code}</code>
        </pre>
      );
    case "blockquote":
      return (
        <div key={bk} className="border-l-[3px] border-primary/40 pl-3 my-1 text-muted italic">
          {block.lines.map((line, i) => renderSingleLine(line, `${bk}-q${i}`))}
        </div>
      );
    case "list":
      return (
        <ul key={bk} className="list-disc list-inside my-1 space-y-0.5 pl-1">
          {block.items.map((item, i) => (
            <li key={`${bk}-li${i}`} className="whitespace-pre-wrap break-words">
              {parseInline(item, `${bk}-li${i}`)}
            </li>
          ))}
        </ul>
      );
    case "lines":
      return (
        <React.Fragment key={bk}>
          {block.lines.map((line, i) => renderSingleLine(line, `${bk}-l${i}`))}
        </React.Fragment>
      );
  }
}

export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = groupBlocks(text.split("\n"));
  return <div className={className}>{blocks.map((b, i) => renderBlock(b, `b${i}`))}</div>;
}
