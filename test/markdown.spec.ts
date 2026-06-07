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

  it("renders __underline__", () => {
    expect(html("__hello__")).toContain("underline");
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
});
