"use client";

import React from "react";

export default function Skeleton({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={`bg-border/30 dark:bg-border/20 rounded-md motion-safe:animate-pulse ${className}`}
      style={style}
    />
  );
}
