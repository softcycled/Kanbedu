import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownText from "../src/components/MarkdownText";

const html = (text: string) => renderToStaticMarkup(React.createElement(MarkdownText, { text }));

describe("MarkdownText (Discord-flavored markdown)", () => {
  it("passes plain text through", () => {
    expect(html("hello")).toContain("hello");
  });

  it("renders *italic* as <em>", () => {
    const h = html("*hello*");
    expect(h).toContain("<em");
    expect(h).toContain("hello");
  });

  it("renders **bold** as <strong>", () => {
    expect(html("**hello**")).toContain("<strong");
  });

  it("renders ***bold italic*** as strong + em", () => {
    const h = html("***hello***");
    expect(h).toContain("<strong");
    expect(h).toContain("<em");
  });

  it("renders ++underline++", () => {
    expect(html("++hello++")).toContain("underline");
  });

  it("renders ~~strikethrough~~", () => {
    expect(html("~~hello~~")).toContain("line-through");
  });

  it("renders # heading at a larger size", () => {
    expect(html("# Title")).toContain("text-xl");
  });

  it("does not treat ** as two italics", () => {
    const h = html("**hello**");
    expect(h).toContain("<strong");
    expect(h).not.toContain("<em");
  });

  it("supports combinations (bold containing strikethrough)", () => {
    const h = html("**a ~~b~~**");
    expect(h).toContain("<strong");
    expect(h).toContain("line-through");
  });

  it("leaves unmatched markers as plain text", () => {
    const h = html("a * b");
    expect(h).not.toContain("<em");
    expect(h).toContain("* b");
  });

  it("renders `code` as <code>", () => {
    const h = html("`hello`");
    expect(h).toContain("<code");
    expect(h).toContain("hello");
  });

  it("does not parse markdown inside inline code", () => {
    const h = html("`**not bold**`");
    expect(h).not.toContain("<strong");
    expect(h).toContain("**not bold**");
  });

  it("renders code fence as <pre>", () => {
    const h = html("```\nconst x = 1;\n```");
    expect(h).toContain("<pre");
    expect(h).toContain("const x = 1;");
  });

  it("renders blockquote with left border class", () => {
    const h = html("> quoted text");
    expect(h).toContain("border-l");
    expect(h).toContain("quoted text");
  });

  it("renders unordered list items as <li>", () => {
    const h = html("- first\n- second");
    expect(h).toContain("<li");
    expect(h).toContain("first");
    expect(h).toContain("second");
  });

  it("renders * list items same as - list items", () => {
    const h = html("* item");
    expect(h).toContain("<li");
    expect(h).toContain("item");
  });

  it("supports inline markdown inside list items", () => {
    const h = html("- **bold item**");
    expect(h).toContain("<li");
    expect(h).toContain("<strong");
  });
});

// Regression guard: the renderer builds React elements (auto-escaped), never
// raw HTML. These lock in that user content can never inject markup. If anyone
// refactors MarkdownText to a string/dangerouslySetInnerHTML approach, these fail.
describe("MarkdownText XSS safety", () => {
  it("escapes raw <script> tags to inert text", () => {
    const h = html("<script>alert('x')</script>");
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });

  it("does not emit an <img> element from raw HTML", () => {
    const h = html("<img src=x onerror=alert(1)>");
    expect(h).not.toContain("<img");
  });

  it("does not turn link syntax into an anchor (no link support)", () => {
    const h = html("[click](javascript:alert(1))");
    expect(h).not.toContain("<a");
    expect(h).not.toContain("href");
  });

  it("escapes HTML even inside markdown markers", () => {
    const h = html("**<b>hi</b>**");
    expect(h).toContain("<strong");
    expect(h).not.toContain("<b>");
    expect(h).toContain("&lt;b&gt;");
  });
});
