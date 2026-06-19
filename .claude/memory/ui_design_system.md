---
name: ui-design-system
description: "Design tokens, component patterns, animations, responsive behavior — fully custom (no shadcn/radix)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 96a83ac3-c244-44c6-a403-d8d68c4aad69
---

**No component library** — fully custom. No shadcn, no radix, no headless UI.

**CSS variables (globals.css):**

Light theme:
- `--c-paper`: #F7F5F0 — page background
- `--c-ink`: #1C1917 — primary text
- `--c-muted`: #78716C — secondary/label text
- `--c-accent`: #2563EB — Kanbedu blue (buttons, links, active states)
- `--c-accent-lt`: #EFF6FF — light blue hover tint
- `--c-column-bg`: #EFEDE8 — kanban column background
- `--c-card-bg`: #FDFCFA — task card background
- `--c-surface`: #F4F2ED — info boxes, panels
- `--c-panel-bg`: #F3F1ED — right properties panel
- `--c-border`: #E2DED8 — dividers
- Status dots: `--c-todo-dot` #94A3B8 / `--c-doing-dot` #F59E0B / `--c-done-dot` #4ADE80

Dark theme: warm near-blacks/off-whites. Status dots identical.

**Shadows:** `--shadow-card` (at rest), `--shadow-card-hover` (lifted), `--shadow-modal` (overlays)

**Animations (tailwind.config.js):**
- `modal-in`: 0.22s scale+translate with spring (cubic-bezier(0.34,1.56,0.64,1))
- `fade-in`: 0.15s opacity ease-out
- `slide-up`: 0.2s translateY spring
- `slide-in-right`: 0.22s translateX from right
- `nudge`: 0.75s wiggle

**Key shared components:**
- `TaskCard` — draggable, priority badge, multi-assignee avatars, deadline, comment count
- `TaskModal` — full editor with inline props (mobile) / right sidebar (desktop)
- `KanbanColumn` — droppable with header options menu
- `ConfirmModal` — generic confirmation dialog
- `FilterBar` — search + assignee + tag + priority filters
- `Toasts` — context-based toast notifications via `useToasts()`
- `Header`, `Sidebar` — top nav and board/class nav

**Responsive:**
- Mobile-first. `md:` (768px) breakpoint for desktop layouts
- TaskModal: inline properties on mobile, right sidebar panel on desktop (`isDesktop` hook)
- Default view mode: board on desktop, list on mobile

**Modal pattern:** Dark backdrop z-50, `modal-in` animation, close on Escape/click-outside, focus trapped inside.

**Loading states:** `Skeleton.tsx` for content placeholders. Optimistic updates (client state before server confirms).

**Toast usage:** `useToasts()` context hook. Used for success confirmations and error feedback.

**Form inputs:** Server-side Zod validation. Client debouncing for description saves (0.8s). Date inputs use `<input type="date">`.
