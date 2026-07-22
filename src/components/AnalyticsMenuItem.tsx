"use client";

import { DropdownItem } from "./ui/DropdownMenu";

// The single "Analytics" entry shared by every board-title dropdown — personal
// boards (BoardHeaderMenu), educator group boards (GroupTitleMenu), and student
// group boards (GroupBoardTitleMenu). Keeping the icon and label in one place
// means they can't drift apart between the three menus. `onSelect` should close
// the owning menu and open the Analytics view.
export default function AnalyticsMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownItem
      onClick={onSelect}
      icon={
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="8" width="3" height="7" rx="0.5" />
          <rect x="6" y="4" width="3" height="11" rx="0.5" />
          <rect x="11" y="1" width="3" height="14" rx="0.5" />
        </svg>
      }
    >
      Analytics
    </DropdownItem>
  );
}
