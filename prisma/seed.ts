/**
 * Seed script: "Web App Group Project" — simulates a realistic student project.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 * Or via:   npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // ── Board ──────────────────────────────────────────────────
  const board = await prisma.board.create({
    data: {
      id: "demo-board-seed-0001",
      name: "Web App Group Project",
    },
  });

  // ── Columns ────────────────────────────────────────────────
  const colTodo = await prisma.column.create({
    data: { label: "To Do", order: 0, isDone: false, boardId: board.id },
  });
  const colInProgress = await prisma.column.create({
    data: { label: "In Progress", order: 1, isDone: false, boardId: board.id },
  });
  const colReview = await prisma.column.create({
    data: { label: "Review", order: 2, isDone: false, boardId: board.id },
  });
  const colDone = await prisma.column.create({
    data: { label: "Done", order: 3, isDone: true, boardId: board.id },
  });

  // ── Seed tasks ─────────────────────────────────────────────
  // Each entry describes a task + its column journey + comments.

  const tasks: Array<{
    title: string;
    description: string;
    assignee: string;
    priority: string;
    deadline: Date | null;
    // journey: array of { columnId, durationDays } — last entry = current column
    // If last column isDone, completedAt = exitedAt of second-to-last
    journey: Array<{ columnId: string; durationDays: number }>;
    comments: Array<{ content: string; daysAgoPosted: number }>;
  }> = [
    // ── Completed tasks ──────────────────────────────────────
    {
      title: "Set up project repository",
      description: "Create GitHub org, init Next.js project, configure ESLint and Prettier.",
      assignee: "Alice",
      priority: "high",
      deadline: daysFromNow(-15),  // on time: completed 18 days ago, deadline 15 days ago
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 2 },
        { columnId: colReview.id, durationDays: 1 },
        { columnId: colDone.id, durationDays: 18 },
      ],
      comments: [
        { content: "I'll use the Next.js 14 App Router template.", daysAgoPosted: 21 },
        { content: "Done! Repo is at github.com/cs301-group4/webapp", daysAgoPosted: 19 },
      ],
    },
    {
      title: "Design database schema",
      description: "ERD for users, boards, tasks, and comments. Review with team before implementation.",
      assignee: "Bob",
      priority: "high",
      deadline: daysFromNow(-10),  // on time: completed 13 days ago, deadline 10 days ago
      journey: [
        { columnId: colTodo.id, durationDays: 2 },
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id, durationDays: 2 },
        { columnId: colDone.id, durationDays: 13 },
      ],
      comments: [
        { content: "Should we use Postgres or SQLite for now?", daysAgoPosted: 18 },
        { content: "SQLite locally, can migrate later. ERD uploaded to Notion.", daysAgoPosted: 17 },
        { content: "Looks good, approved!", daysAgoPosted: 15 },
      ],
    },
    {
      title: "Implement authentication",
      description: "NextAuth with Google OAuth. Protect dashboard routes. Add session middleware.",
      assignee: "Alice",
      priority: "urgent",
      deadline: daysFromNow(-8),   // on time: completed 10 days ago, deadline 8 days ago
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 5 },
        { columnId: colReview.id, durationDays: 2 },
        { columnId: colDone.id, durationDays: 10 },
      ],
      comments: [
        { content: "OAuth callback URL needs to match prod domain eventually.", daysAgoPosted: 16 },
        { content: "Session middleware works locally. Need to test edge cases.", daysAgoPosted: 14 },
        { content: "Reviewed — minor: redirect after login should go to /dashboard", daysAgoPosted: 13 },
        { content: "Fixed and merged!", daysAgoPosted: 12 },
      ],
    },
    {
      title: "Build landing page",
      description: "Hero section, feature highlights, CTA button. Must be responsive.",
      assignee: "Carol",
      priority: "medium",
      deadline: daysFromNow(-10),
      journey: [
        { columnId: colTodo.id, durationDays: 3 },
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id, durationDays: 1 },
        { columnId: colDone.id, durationDays: 9 },
      ],
      comments: [
        { content: "Using Tailwind for the layout. Figma mockup shared in Slack.", daysAgoPosted: 13 },
        { content: "Mobile breakpoint looks off on 375px — will fix.", daysAgoPosted: 11 },
        { content: "All good now, merged.", daysAgoPosted: 10 },
      ],
    },
    {
      title: "Create task CRUD API",
      description: "REST endpoints: POST/GET/PATCH/DELETE for tasks. Include column assignment.",
      assignee: "Bob",
      priority: "high",
      deadline: daysFromNow(-8),
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 4 },
        { columnId: colReview.id, durationDays: 1 },
        { columnId: colDone.id, durationDays: 7 },
      ],
      comments: [
        { content: "Should PATCH also update order or keep that separate?", daysAgoPosted: 12 },
        { content: "Keep it separate — cleaner API boundaries.", daysAgoPosted: 12 },
        { content: "Endpoints done and documented in Postman collection.", daysAgoPosted: 9 },
      ],
    },
    {
      title: "Write unit tests for API routes",
      description: "Cover task creation, update, deletion. Use Vitest + MSW for mocking.",
      assignee: "Dave",
      priority: "medium",
      deadline: daysFromNow(-5),
      journey: [
        { columnId: colTodo.id, durationDays: 4 },
        { columnId: colInProgress.id, durationDays: 6 },
        { columnId: colReview.id, durationDays: 3 },
        { columnId: colDone.id, durationDays: 4 },
      ],
      comments: [
        { content: "Starting with the DELETE route since it's highest risk.", daysAgoPosted: 10 },
        { content: "78% coverage so far.", daysAgoPosted: 7 },
        { content: "Needs more edge case coverage for null column moves.", daysAgoPosted: 6 },
        { content: "Added 4 more tests, coverage at 91%. Merging.", daysAgoPosted: 5 },
      ],
    },

    // ── In review ────────────────────────────────────────────
    {
      title: "Drag-and-drop kanban board",
      description: "Implement @dnd-kit. Task cards sortable within and across columns. Persist order to DB.",
      assignee: "Alice",
      priority: "high",
      deadline: daysFromNow(2),
      journey: [
        { columnId: colTodo.id, durationDays: 2 },
        { columnId: colInProgress.id, durationDays: 5 },
        { columnId: colReview.id, durationDays: 2 },
      ],
      comments: [
        { content: "Pointer events are tricky on mobile — testing on iOS now.", daysAgoPosted: 5 },
        { content: "Edge scroll during drag is nice, good call adding that.", daysAgoPosted: 3 },
        { content: "PR is up. One conflict in Board.tsx to resolve.", daysAgoPosted: 2 },
      ],
    },
    {
      title: "Analytics dashboard",
      description: "Show task completion rate, time in phase, and per-member stats for the lecturer.",
      assignee: "Carol",
      priority: "high",
      deadline: daysFromNow(5),
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 4 },
        { columnId: colReview.id, durationDays: 1 },
      ],
      comments: [
        { content: "Should we show per-phase avg time? Lecturer asked for that specifically.", daysAgoPosted: 4 },
        { content: "Yes, I'm pulling from columnHistory. Will have numbers once more tasks complete.", daysAgoPosted: 3 },
        { content: "Looking great! Just needs a loading state when data is empty.", daysAgoPosted: 1 },
      ],
    },

    // ── In progress ──────────────────────────────────────────
    {
      title: "Comment system with real-time updates",
      description: "Users can comment on tasks. Polling every 15s or use Pusher for live updates.",
      assignee: "Dave",
      priority: "medium",
      deadline: daysFromNow(7),
      journey: [
        { columnId: colTodo.id, durationDays: 3 },
        { columnId: colInProgress.id, durationDays: 4 },
      ],
      comments: [
        { content: "Going with polling for now — Pusher adds cost.", daysAgoPosted: 3 },
        { content: "Basic comments work, wiring up the 15s interval now.", daysAgoPosted: 1 },
      ],
    },
    {
      title: "File attachment support",
      description: "Allow users to attach files to tasks. Store in S3 or Cloudflare R2.",
      assignee: "Bob",
      priority: "low",
      deadline: daysFromNow(14),
      journey: [
        { columnId: colTodo.id, durationDays: 5 },
        { columnId: colInProgress.id, durationDays: 3 },
      ],
      comments: [
        { content: "R2 is much cheaper than S3 for our use case.", daysAgoPosted: 2 },
      ],
    },
    {
      title: "Email notifications on task assignment",
      description: "Send email when a task is assigned to a user. Use Resend API.",
      assignee: "Carol",
      priority: "low",
      deadline: daysFromNow(18),
      journey: [
        { columnId: colTodo.id, durationDays: 6 },
        { columnId: colInProgress.id, durationDays: 2 },
      ],
      comments: [],
    },

    // ── Stagnant: in progress for a long time ─────────────────
    {
      title: "Accessibility audit (WCAG 2.1)",
      description: "Run axe-core on all pages. Fix contrast issues, ARIA labels, keyboard navigation.",
      assignee: "Dave",
      priority: "medium",
      deadline: daysFromNow(3),
      journey: [
        { columnId: colTodo.id, durationDays: 2 },
        { columnId: colInProgress.id, durationDays: 9 }, // stagnant
      ],
      comments: [
        { content: "There are 14 axe violations on the board page alone.", daysAgoPosted: 8 },
        { content: "This is taking longer than expected — a lot of components need ARIA roles.", daysAgoPosted: 5 },
      ],
    },

    // ── To do ────────────────────────────────────────────────
    {
      title: "End-to-end tests with Playwright",
      description: "Cover login flow, task creation, drag-and-drop, and comment posting.",
      assignee: "Alice",
      priority: "medium",
      deadline: daysFromNow(10),
      journey: [
        { columnId: colTodo.id, durationDays: 0 },
      ],
      comments: [],
    },
    {
      title: "Performance optimisation",
      description: "Lighthouse score below 80 on mobile. Investigate bundle size and image optimisation.",
      assignee: "",
      priority: "medium",
      deadline: daysFromNow(12),
      journey: [
        { columnId: colTodo.id, durationDays: 0 },
      ],
      comments: [
        { content: "Unassigned — anyone free to pick this up?", daysAgoPosted: 1 },
      ],
    },
    {
      title: "Deployment to Vercel",
      description: "Set up CI/CD pipeline. Configure env vars, preview deployments on PRs.",
      assignee: "Bob",
      priority: "high",
      deadline: daysFromNow(6),
      journey: [
        { columnId: colTodo.id, durationDays: 0 },
      ],
      comments: [],
    },
    // Overdue to-do
    {
      title: "Write API documentation",
      description: "Document all endpoints in OpenAPI spec. Host on /api-docs with Swagger UI.",
      assignee: "Carol",
      priority: "low",
      deadline: daysFromNow(-3), // overdue
      journey: [
        { columnId: colTodo.id, durationDays: 0 },
      ],
      comments: [
        { content: "This was supposed to be done by last week.", daysAgoPosted: 1 },
      ],
    },
  ];

  // ── Write to DB ────────────────────────────────────────────

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];

    // Build timeline from journey
    let cursor = daysAgo(
      t.journey.reduce((sum, j) => sum + j.durationDays, 0)
    );
    const createdAt = new Date(cursor);

    // Walk through journey to find current column and columnUpdatedAt
    const lastJourney = t.journey[t.journey.length - 1];
    const currentColumnId = lastJourney.columnId;

    // columnUpdatedAt = when the task entered its current column
    let colUpdatedAt = new Date(cursor);
    for (let j = 0; j < t.journey.length - 1; j++) {
      colUpdatedAt = new Date(cursor);
      cursor = new Date(cursor.getTime() + t.journey[j].durationDays * 86_400_000);
    }
    colUpdatedAt = new Date(cursor);

    // completedAt: if current column isDone, set to when it entered done
    const isDone = currentColumnId === colDone.id;
    const completedAt = isDone ? colUpdatedAt : null;

    const task = await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        assignee: t.assignee,
        priority: t.priority,
        deadline: t.deadline,
        createdAt,
        updatedAt: colUpdatedAt,
        completedAt,
        column: currentColumnId,
        columnUpdatedAt: colUpdatedAt,
        order: i,
      },
    });

    // ── Column history ────────────────────────────────────────
    let histCursor = new Date(createdAt);
    for (let j = 0; j < t.journey.length; j++) {
      const step = t.journey[j];
      const enteredAt = new Date(histCursor);
      const isLast = j === t.journey.length - 1;
      const exitedAt = isLast
        ? null
        : new Date(histCursor.getTime() + step.durationDays * 86_400_000);

      await prisma.taskColumnHistory.create({
        data: {
          taskId: task.id,
          columnId: step.columnId,
          enteredAt,
          exitedAt,
        },
      });

      if (!isLast) {
        histCursor = exitedAt!;
      }
    }

    // ── Comments ──────────────────────────────────────────────
    for (const c of t.comments) {
      await prisma.comment.create({
        data: {
          taskId: task.id,
          content: c.content,
          createdAt: daysAgo(c.daysAgoPosted),
        },
      });
    }
  }

  console.log(`✓ Seeded board "${board.name}" with ${tasks.length} tasks across 4 columns.`);
  console.log(`  Board ID: ${board.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
