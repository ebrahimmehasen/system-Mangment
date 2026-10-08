"use client";

import type { ReactNode } from "react";

const EDGE = 90;
const STEP = 28;

/** Horizontal board container that auto-scrolls when a dragged card is held near its left/right edge, so far-away day columns are reachable. */
export function BoardScroller({ children }: { children: ReactNode }) {
  return (
    <div
      className="no-scrollbar flex gap-3 overflow-x-auto pb-2"
      onDragOver={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        if (e.clientX < box.left + EDGE) e.currentTarget.scrollBy({ left: -STEP });
        else if (e.clientX > box.right - EDGE) e.currentTarget.scrollBy({ left: STEP });
      }}
    >
      {children}
    </div>
  );
}
