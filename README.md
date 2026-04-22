# Kanbedu

A lightweight kanban board built for student group projects. Fast, minimal, no clutter.

## Stack

- **Next.js 14** (App Router)
- **SQLite** via Prisma ORM
- **Tailwind CSS**
- **dnd-kit** for drag and drop

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

```bash
npx prisma db push
npx prisma generate
```

This creates a local `dev.db` SQLite file inside the `prisma/` directory.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
kanbedu/
├── prisma/
│   └── schema.prisma         # Database schema (Task, Comment)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tasks/
│   │   │   │   ├── route.ts          # GET all tasks, POST new task
│   │   │   │   └── [id]/route.ts     # PATCH update, DELETE task
│   │   │   └── comments/
│   │   │       └── route.ts          # POST new comment
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Server component, fetches board data
│   ├── components/
│   │   ├── Board.tsx                 # DnD context, state management
│   │   ├── KanbanColumn.tsx          # Column with droppable zone
│   │   ├── TaskCard.tsx              # Draggable task card
│   │   ├── TaskModal.tsx             # Task detail modal with auto-save
│   │   └── AddTask.tsx               # Inline task creation input
│   └── lib/
│       ├── prisma.ts                 # Prisma singleton
│       ├── types.ts                  # Shared TypeScript types
│       └── utils.ts                  # Time helpers, date formatting
├── .env                              # DATABASE_URL
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Features

- **3-column kanban**: To Do → Doing → Done
- **Drag & drop**: Smooth task movement between columns
- **Inline task creation**: Type + Enter, no modals
- **Task modal**: Click any card to view/edit details
- **Auto-save**: Description, assignee, deadline save as you type (debounced)
- **Comments**: Simple per-task comment thread
- **Time in column**: Each card shows how long a task has been in its current column
- **Overdue indicator**: Red dot on cards past their deadline

## Useful Commands

```bash
npm run db:studio     # Open Prisma Studio (visual DB browser)
npm run db:push       # Push schema changes to DB
npm run build         # Production build
```
## Things To Note

This readme.md section will easily be outdated in the future, and is subject to change.