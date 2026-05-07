/**
 * Demo seed: creates 3 showcase boards with realistic fake data.
 * Run with:  npx tsx prisma/seed.ts
 * Wipe only demo boards: npx tsx prisma/wipe-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Demo users ────────────────────────────────────────────────
// All share the password "demo1234" for easy testing.
const DEMO_USERS = [
  { id: "demo-user-alice", name: "Alice",  email: "alice@demo.kanbedu"  },
  { id: "demo-user-bob",   name: "Bob",    email: "bob@demo.kanbedu"    },
  { id: "demo-user-carol", name: "Carol",  email: "carol@demo.kanbedu"  },
  { id: "demo-user-dave",  name: "Dave",   email: "dave@demo.kanbedu"   },
  { id: "demo-user-jake",  name: "Jake",   email: "jake@demo.kanbedu"   },
  { id: "demo-user-emma",  name: "Emma",   email: "emma@demo.kanbedu"   },
  { id: "demo-user-priya", name: "Priya",  email: "priya@demo.kanbedu"  },
  { id: "demo-user-sam",   name: "Sam",    email: "sam@demo.kanbedu"    },
  { id: "demo-user-mia",   name: "Mia",    email: "mia@demo.kanbedu"    },
];

// ── Helpers ───────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Shared types ──────────────────────────────────────────────

type TaskDef = {
  title: string;
  description: string;
  assignee: string;
  priority: string;
  deadline: Date | null;
  movedByNonAssignee?: boolean;
  journey: Array<{ columnId: string; durationDays: number }>;
  comments: Array<{ content: string; daysAgoPosted: number; author?: string }>;};;

// ── Shared write helper ────────────────────────────────────────

async function writeTasks(tasks: TaskDef[], doneColumnId: string, userMap: Map<string, string>) {
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

    // completedAt: if current column is the done column, set to when it entered done
    const isDone = currentColumnId === doneColumnId;
    const completedAt = isDone ? colUpdatedAt : null;

    const task = await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        assigneeId: userMap.get(t.assignee) ?? null,
        priority: t.priority,
        deadline: t.deadline,
        createdAt,
        updatedAt: colUpdatedAt,
        completedAt,
        column: currentColumnId,
        columnUpdatedAt: colUpdatedAt,
        order: i,
        movedByNonAssignee: t.movedByNonAssignee ?? false,
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
          author: c.author ?? t.assignee,
          createdAt: daysAgo(c.daysAgoPosted),
        },
      });
    }
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // ── Demo users ────────────────────────────────────────────────
  const hashed = await bcrypt.hash("demo1234", 10);
  const users = await Promise.all(
    DEMO_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { id: u.id, name: u.name, email: u.email, password: hashed },
      })
    )
  );
  // name → userId lookup for assigning tasks
  const userMap = new Map(users.map((u) => [u.name, u.id]));
  console.log(`✓ Upserted ${users.length} demo users.`);

  // ── Board ──────────────────────────────────────────────────
  const board = await prisma.board.create({
    data: {
      id: "demo-board-seed-0001",
      name: "[On Track] Web App Group Project",
      order: 0,
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

  const tasks: TaskDef[] = [
    // ── Completed tasks ──────────────────────────────────────
    {
      title: "Set up project repository",
      description: "Create GitHub org, init Next.js project, configure ESLint and Prettier.",
      assignee: "Alice",
      priority: "high",
      deadline: daysFromNow(-15),
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 2 },
        { columnId: colReview.id, durationDays: 4 },
        { columnId: colDone.id, durationDays: 14 },
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
      deadline: daysFromNow(-10),
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id, durationDays: 5 },
        { columnId: colDone.id, durationDays: 9 },
      ],
      comments: [
        { content: "Should we use Postgres or SQLite for now?", daysAgoPosted: 18 },
        { content: "SQLite locally, can migrate later. ERD uploaded to Notion.", daysAgoPosted: 17 },
        { content: "Looks good, approved!", daysAgoPosted: 15, author: "Alice" },
      ],
    },
    {
      title: "Implement authentication",
      description: "NextAuth with Google OAuth. Protect dashboard routes. Add session middleware.",
      assignee: "Alice",
      priority: "urgent",
      deadline: daysFromNow(-8),
      journey: [
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 4 },
        { columnId: colReview.id, durationDays: 6 },
        { columnId: colDone.id, durationDays: 8 },
      ],
      comments: [
        { content: "OAuth callback URL needs to match prod domain eventually.", daysAgoPosted: 16 },
        { content: "Session middleware works locally. Need to test edge cases.", daysAgoPosted: 14 },
        { content: "Reviewed \u2014 minor: redirect after login should go to /dashboard", daysAgoPosted: 13, author: "Bob" },
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
        { columnId: colTodo.id, durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 2 },
        { columnId: colReview.id, durationDays: 4 },
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
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id, durationDays: 5 },
        { columnId: colDone.id, durationDays: 7 },
      ],
      comments: [
        { content: "Should PATCH also update order or keep that separate?", daysAgoPosted: 12 },
        { content: "Keep it separate \u2014 cleaner API boundaries.", daysAgoPosted: 12, author: "Alice" },
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
        { columnId: colTodo.id, durationDays: 2 },
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id, durationDays: 6 },
        { columnId: colDone.id, durationDays: 4 },
      ],
      comments: [
        { content: "Starting with the DELETE route since it's highest risk.", daysAgoPosted: 10 },
        { content: "78% coverage so far.", daysAgoPosted: 7 },
        { content: "Needs more edge case coverage for null column moves.", daysAgoPosted: 6, author: "Bob" },
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
        { content: "Edge scroll during drag is nice, good call adding that.", daysAgoPosted: 3, author: "Bob" },
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
        { content: "Should we show per-phase avg time? Lecturer asked for that specifically.", daysAgoPosted: 4, author: "Dave" },
        { content: "Yes, I'm pulling from columnHistory. Will have numbers once more tasks complete.", daysAgoPosted: 3 },
        { content: "Looking great! Just needs a loading state when data is empty.", daysAgoPosted: 1, author: "Alice" },
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
        { columnId: colTodo.id, durationDays: 1 },
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
        { columnId: colTodo.id, durationDays: 2 },
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
        { columnId: colTodo.id, durationDays: 2 },
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

    // ── Suspicious: speed-run ─────────────────────────────────
    // Went through all 4 columns in ~35 minutes — flagged as speed-run.
    {
      title: "Update README with setup instructions",
      description: "Add local dev setup steps, env var list, and how to run the seed.",
      assignee: "Dave",
      priority: "low",
      deadline: daysFromNow(5),
      journey: [
        { columnId: colTodo.id,       durationDays: 0.003 }, // ~4 min
        { columnId: colInProgress.id, durationDays: 0.008 }, // ~12 min
        { columnId: colReview.id,     durationDays: 0.004 }, // ~6 min
        { columnId: colDone.id,       durationDays: 1 },
      ],
      comments: [
        { content: "Done, just a quick README update.", daysAgoPosted: 1 },
      ],
    },

    // ── Suspicious: column-skip ───────────────────────────────
    // Jumped directly from To Do → Done, bypassing In Progress and Review.
    {
      title: "Add .env.example file",
      description: "Template .env file listing all required environment variables with placeholder values.",
      assignee: "Carol",
      priority: "low",
      deadline: daysFromNow(4),
      journey: [
        { columnId: colTodo.id,  durationDays: 1 },
        { columnId: colDone.id,  durationDays: 2 },
      ],
      comments: [
        { content: "It\'s just one file, marking as done.", daysAgoPosted: 2 },
      ],
    },

    // ── Suspicious: moved by non-assignee ─────────────────────
    // Alice's task was moved to Done by a teammate while she was away.
    {
      title: "Configure ESLint and Prettier",
      description: "Enforce consistent code style across the project. Add pre-commit hook via husky.",
      assignee: "Alice",
      priority: "low",
      deadline: daysFromNow(-5),
      movedByNonAssignee: true,
      journey: [
        { columnId: colTodo.id,       durationDays: 1 },
        { columnId: colInProgress.id, durationDays: 3 },
        { columnId: colReview.id,     durationDays: 2 },
        { columnId: colDone.id,       durationDays: 4 },
      ],
      comments: [
        { content: "Rules config is in .eslintrc.json. Prettier integrated.", daysAgoPosted: 6 },
        { content: "Moving this to Done — Alice asked me to close it out.", daysAgoPosted: 4, author: "Bob" },
      ],
    },
  ];

  await writeTasks(tasks, colDone.id, userMap);
  // Add all 4 web app members to board 1
  for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
    const uid = userMap.get(name);
    if (uid) await prisma.boardMember.upsert({ where: { userId_boardId: { userId: uid, boardId: board.id } }, update: {}, create: { userId: uid, boardId: board.id } });
  }
  console.log(`✓ Seeded board "${board.name}" with ${tasks.length} tasks across 4 columns.`);
  console.log(`  Board ID: ${board.id}`);

  // ── Board 2: [Struggling] Mobile App MVP Sprint ───────────────

  const b2 = await prisma.board.create({
    data: { id: "demo-board-seed-0002", name: "[Struggling] Mobile App MVP Sprint", order: 1 },
  });
  const b2Todo = await prisma.column.create({ data: { label: "To Do", order: 0, isDone: false, boardId: b2.id } });
  const b2InProg = await prisma.column.create({ data: { label: "In Progress", order: 1, isDone: false, boardId: b2.id } });
  const b2Testing = await prisma.column.create({ data: { label: "Testing", order: 2, isDone: false, boardId: b2.id } });
  const b2Done = await prisma.column.create({ data: { label: "Done", order: 3, isDone: true, boardId: b2.id } });

  const b2Tasks: TaskDef[] = [
    // ── Completed (2 on time, 4 late) ────────────────────────
    // ON TIME: completed far in the past, deadline was before that
    {
      title: "API client setup (Axios)",
      description: "Configure Axios instance with base URL, interceptors, and error handling.",
      assignee: "Jake",
      priority: "medium",
      deadline: daysFromNow(-35),
      journey: [
        { columnId: b2Todo.id,    durationDays: 1 },
        { columnId: b2InProg.id,  durationDays: 7 },
        { columnId: b2Testing.id, durationDays: 3 },
        { columnId: b2Done.id,    durationDays: 38 },
      ],
      comments: [
        { content: "Using Axios with retry logic for flaky network conditions.", daysAgoPosted: 49 },
        { content: "Done and integrated with auth token headers.", daysAgoPosted: 47 },
      ],
    },
    {
      title: "Navigation setup (React Navigation)",
      description: "Configure stack + tab navigators. Set up deep linking for push notification routes.",
      assignee: "Emma",
      priority: "high",
      deadline: daysFromNow(-40),
      journey: [
        { columnId: b2Todo.id,    durationDays: 1 },
        { columnId: b2InProg.id,  durationDays: 8 },
        { columnId: b2Testing.id, durationDays: 3 },
        { columnId: b2Done.id,    durationDays: 42 },
      ],
      comments: [
        { content: "Deep linking config is documented in the Notion wiki.", daysAgoPosted: 53 },
        { content: "All done, merged!", daysAgoPosted: 52 },
      ],
    },
    // LATE: completed recently, deadline was before that
    {
      title: "Set up Expo project",
      description: "Init Expo app, configure TypeScript, set up folder structure and linting.",
      assignee: "Emma",
      priority: "high",
      deadline: daysFromNow(-8),
      journey: [
        { columnId: b2Todo.id,    durationDays: 2 },
        { columnId: b2InProg.id,  durationDays: 9 },
        { columnId: b2Testing.id, durationDays: 5 },
        { columnId: b2Done.id,    durationDays: 3 },
      ],
      comments: [
        { content: "Took longer than expected to configure the TypeScript paths.", daysAgoPosted: 17 },
        { content: "Finally done, merged into main.", daysAgoPosted: 14 },
      ],
    },
    {
      title: "User authentication (JWT)",
      description: "Implement JWT-based login and registration. Store token in SecureStore.",
      assignee: "Jake",
      priority: "urgent",
      deadline: daysFromNow(-10),
      journey: [
        { columnId: b2Todo.id,    durationDays: 1 },
        { columnId: b2InProg.id,  durationDays: 10 },
        { columnId: b2Testing.id, durationDays: 5 },
        { columnId: b2Done.id,    durationDays: 2 },
      ],
      comments: [
        { content: "SecureStore API is tricky on Android emulator.", daysAgoPosted: 15 },
        { content: "Token refresh logic is done. Moving to testing.", daysAgoPosted: 11 },
        { content: "Approved, but login UI still needs polish.", daysAgoPosted: 10, author: "Priya" },
      ],
    },
    {
      title: "Home screen layout",
      description: "Main dashboard with activity feed, quick actions, and bottom tab navigation.",
      assignee: "Priya",
      priority: "high",
      deadline: daysFromNow(-12),
      journey: [
        { columnId: b2Todo.id,    durationDays: 1 },
        { columnId: b2InProg.id,  durationDays: 8 },
        { columnId: b2Testing.id, durationDays: 4 },
        { columnId: b2Done.id,    durationDays: 4 },
      ],
      comments: [
        { content: "Bottom nav duplicating on some Android devices — investigating.", daysAgoPosted: 14 },
        { content: "Fixed, was a SafeAreaView issue.", daysAgoPosted: 11 },
      ],
    },
    {
      title: "Profile screen",
      description: "User profile with avatar, bio, and settings link. Supports avatar upload to S3.",
      assignee: "Priya",
      priority: "medium",
      deadline: daysFromNow(-9),
      journey: [
        { columnId: b2Todo.id,    durationDays: 2 },
        { columnId: b2InProg.id,  durationDays: 9 },
        { columnId: b2Testing.id, durationDays: 5 },
        { columnId: b2Done.id,    durationDays: 5 },
      ],
      comments: [
        { content: "Avatar upload blocked by S3 bucket perms.", daysAgoPosted: 16 },
        { content: "Fixed. S3 CORS config was wrong.", daysAgoPosted: 12 },
        { content: "UI could be cleaner but unblocking the sprint.", daysAgoPosted: 6, author: "Jake" },
      ],
    },

    // ── In testing ────────────────────────────────────────────
    {
      title: "Offline mode handling",
      description: "Cache API responses and show offline banner when network is unavailable.",
      assignee: "Jake",
      priority: "high",
      deadline: daysFromNow(1),
      journey: [
        { columnId: b2Todo.id,    durationDays: 1 },
        { columnId: b2InProg.id,  durationDays: 9 },
        { columnId: b2Testing.id, durationDays: 3 },
      ],
      comments: [
        { content: "AsyncStorage hitting size limits on large caches.", daysAgoPosted: 6 },
        { content: "Switched to MMKV. Much faster.", daysAgoPosted: 4 },
        { content: "Basic offline banner works. Testing edge cases.", daysAgoPosted: 2 },
      ],
    },
    {
      title: "Search functionality",
      description: "Full-text search across posts and users with debounced input.",
      assignee: "Priya",
      priority: "medium",
      deadline: daysFromNow(3),
      journey: [
        { columnId: b2Todo.id,    durationDays: 2 },
        { columnId: b2InProg.id,  durationDays: 8 },
        { columnId: b2Testing.id, durationDays: 2 },
      ],
      comments: [
        { content: "Debounce at 300ms — feels snappy.", daysAgoPosted: 4 },
        { content: "Backend search index slow for large result sets.", daysAgoPosted: 2 },
      ],
    },

    // ── In progress (stagnant / blocked) ──────────────────────
    {
      title: "Push notification integration",
      description: "Expo Notifications API. Handle foreground, background, and killed app states.",
      assignee: "Emma",
      priority: "urgent",
      deadline: daysFromNow(-2),
      journey: [
        { columnId: b2Todo.id,   durationDays: 1 },
        { columnId: b2InProg.id, durationDays: 10 },
      ],
      comments: [
        { content: "Expo push service intermittently down — raising a support ticket.", daysAgoPosted: 8 },
        { content: "Still stuck on background notification handlers on iOS.", daysAgoPosted: 4 },
      ],
    },
    {
      title: "Payment integration (Stripe)",
      description: "In-app purchases via Stripe SDK. Handle webhooks server-side.",
      assignee: "Jake",
      priority: "urgent",
      deadline: daysFromNow(-4),
      journey: [
        { columnId: b2Todo.id,   durationDays: 2 },
        { columnId: b2InProg.id, durationDays: 12 },
      ],
      comments: [
        { content: "Stripe webhook signature validation keeps failing in staging.", daysAgoPosted: 10 },
        { content: "Found it — header was mutated by middleware.", daysAgoPosted: 7 },
        { content: "Still seeing intermittent failures. Blocked.", daysAgoPosted: 3 },
      ],
    },
    {
      title: "Dark mode support",
      description: "System-level dark mode using the React Native Appearance API.",
      assignee: "Priya",
      priority: "low",
      deadline: daysFromNow(10),
      journey: [
        { columnId: b2Todo.id,   durationDays: 1 },
        { columnId: b2InProg.id, durationDays: 4 },
      ],
      comments: [
        { content: "Most components done. Charts library doesn't support dark mode natively.", daysAgoPosted: 2 },
      ],
    },
    {
      title: "App store submission prep",
      description: "Screenshots, app description, privacy policy, and age rating declaration.",
      assignee: "Emma",
      priority: "high",
      deadline: daysFromNow(7),
      journey: [
        { columnId: b2Todo.id,   durationDays: 1 },
        { columnId: b2InProg.id, durationDays: 3 },
      ],
      comments: [],
    },

    // ── To do ─────────────────────────────────────────────────
    {
      title: "Crash reporting (Sentry)",
      description: "Integrate Sentry for crash logs and performance monitoring.",
      assignee: "Jake",
      priority: "high",
      deadline: daysFromNow(-1),
      journey: [{ columnId: b2Todo.id, durationDays: 0 }],
      comments: [
        { content: "This keeps slipping — must do before TestFlight.", daysAgoPosted: 1 },
      ],
    },
    {
      title: "Beta testing feedback form",
      description: "In-app form for testers to submit bug reports and suggestions.",
      assignee: "",
      priority: "medium",
      deadline: daysFromNow(5),
      journey: [{ columnId: b2Todo.id, durationDays: 0 }],
      comments: [
        { content: "Can we use Typeform instead of building this custom?", daysAgoPosted: 2 },
      ],
    },
    {
      title: "Performance profiling",
      description: "Profile bundle size and rendering performance. Target < 3s cold start.",
      assignee: "",
      priority: "medium",
      deadline: daysFromNow(14),
      journey: [{ columnId: b2Todo.id, durationDays: 0 }],
      comments: [],
    },

    // ── Suspicious: speed-run ─────────────────────────────────
    // Went through all 4 columns in ~21 minutes.
    {
      title: "Update app icon",
      description: "Replace placeholder icon with final branded asset in all required sizes.",
      assignee: "Emma",
      priority: "low",
      deadline: daysFromNow(3),
      journey: [
        { columnId: b2Todo.id,    durationDays: 0.003 },
        { columnId: b2InProg.id,  durationDays: 0.008 },
        { columnId: b2Testing.id, durationDays: 0.004 },
        { columnId: b2Done.id,    durationDays: 1 },
      ],
      comments: [{ content: "Icons updated across all required sizes.", daysAgoPosted: 1 }],
    },

    // ── Suspicious: column-skip + moved by non-assignee ─────────
    // Jake moved Priya's spinner card directly to Done while she was heads-down elsewhere.
    {
      title: "Add loading spinner component",
      description: "Reusable loading spinner used across all async screens.",
      assignee: "Priya",
      priority: "low",
      deadline: daysFromNow(2),
      movedByNonAssignee: true,
      journey: [
        { columnId: b2Todo.id,  durationDays: 1 },
        { columnId: b2Done.id,  durationDays: 2 },
      ],
      comments: [
        { content: "It's just a spinner, pushing straight to done.", daysAgoPosted: 2, author: "Jake" },
      ],
    },
  ];

  await writeTasks(b2Tasks, b2Done.id, userMap);
  // Add mobile app members to board 2
  for (const name of ["Jake", "Emma", "Priya"]) {
    const uid = userMap.get(name);
    if (uid) await prisma.boardMember.upsert({ where: { userId_boardId: { userId: uid, boardId: b2.id } }, update: {}, create: { userId: uid, boardId: b2.id } });
  }
  console.log(`✓ Seeded board "${b2.name}" with ${b2Tasks.length} tasks across 4 columns.`);
  console.log(`  Board ID: ${b2.id}`);

  // ── Board 3: [Winding Down] Research Paper ────────────────────

  const b3 = await prisma.board.create({
    data: { id: "demo-board-seed-0003", name: "[Winding Down] Research Paper", order: 2 },
  });
  const b3LitRev  = await prisma.column.create({ data: { label: "Literature Review", order: 0, isDone: false, boardId: b3.id } });
  const b3Writing = await prisma.column.create({ data: { label: "Writing",           order: 1, isDone: false, boardId: b3.id } });
  const b3Editing = await prisma.column.create({ data: { label: "Editing",           order: 2, isDone: false, boardId: b3.id } });
  const b3Done    = await prisma.column.create({ data: { label: "Done",              order: 3, isDone: true,  boardId: b3.id } });

  const b3Tasks: TaskDef[] = [
    // ── Completed (8 on time, 1 late) ────────────────────────
    // ON TIME: completedAt (daysAgo X) where X > deadline absolute days
    {
      title: "Literature review: background & motivation",
      description: "Survey 10+ papers on the topic. Summarise key findings in a shared doc.",
      assignee: "Sam",
      priority: "high",
      deadline: daysFromNow(-22),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 3 },
        { columnId: b3Editing.id, durationDays: 1 },
        { columnId: b3Done.id,    durationDays: 25 },
      ],
      comments: [
        { content: "Found a great 2023 survey paper that covers most of our gaps.", daysAgoPosted: 30 },
        { content: "Summary doc shared with Mia for review.", daysAgoPosted: 27 },
        { content: "Minor edits done. Section finalised.", daysAgoPosted: 26, author: "Mia" },
      ],
    },
    {
      title: "Related work section",
      description: "Compare and contrast 5 key related systems. Add to Section 2.",
      assignee: "Mia",
      priority: "high",
      deadline: daysFromNow(-20),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 2 },
        { columnId: b3Writing.id, durationDays: 2 },
        { columnId: b3Editing.id, durationDays: 2 },
        { columnId: b3Done.id,    durationDays: 22 },
      ],
      comments: [
        { content: "Added a comparison table — much easier to read.", daysAgoPosted: 28 },
        { content: "Reviewed. Good job on the table.", daysAgoPosted: 26, author: "Sam" },
      ],
    },
    {
      title: "Methodology section",
      description: "Describe research design, data collection, and analysis approach.",
      assignee: "Sam",
      priority: "high",
      deadline: daysFromNow(-18),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 4 },
        { columnId: b3Editing.id, durationDays: 1 },
        { columnId: b3Done.id,    durationDays: 20 },
      ],
      comments: [
        { content: "Using a mixed-methods approach — qualitative interviews + survey.", daysAgoPosted: 26 },
        { content: "Sam's draft is solid. Just needs a diagram.", daysAgoPosted: 24, author: "Mia" },
        { content: "Diagram added, section finalised.", daysAgoPosted: 23 },
      ],
    },
    {
      title: "Survey design & pilot",
      description: "Design 20-question survey in Google Forms. Pilot with 5 participants.",
      assignee: "Mia",
      priority: "medium",
      deadline: daysFromNow(-15),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 2 },
        { columnId: b3Writing.id, durationDays: 3 },
        { columnId: b3Editing.id, durationDays: 2 },
        { columnId: b3Done.id,    durationDays: 17 },
      ],
      comments: [
        { content: "Pilot feedback was positive — only minor wording changes needed.", daysAgoPosted: 22 },
        { content: "Survey is live.", daysAgoPosted: 20 },
      ],
    },
    {
      title: "Analyse survey results",
      description: "Compile 87 responses. Run descriptive stats and thematic analysis.",
      assignee: "Sam",
      priority: "high",
      deadline: daysFromNow(-13),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 2 },
        { columnId: b3Editing.id, durationDays: 1 },
        { columnId: b3Done.id,    durationDays: 15 },
      ],
      comments: [
        { content: "87 responses — better than expected!", daysAgoPosted: 18 },
        { content: "Thematic analysis done. 4 major themes identified.", daysAgoPosted: 16 },
      ],
    },
    {
      title: "Results section",
      description: "Write up findings with charts and tables from the analysis.",
      assignee: "Mia",
      priority: "high",
      deadline: daysFromNow(-10),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 4 },
        { columnId: b3Editing.id, durationDays: 2 },
        { columnId: b3Done.id,    durationDays: 12 },
      ],
      comments: [
        { content: "Charts exported from R — looks great.", daysAgoPosted: 15 },
        { content: "One chart's labels are too small, fixing.", daysAgoPosted: 13 },
        { content: "Done. Results section approved.", daysAgoPosted: 12 },
      ],
    },
    {
      title: "Discussion section",
      description: "Interpret results in context of related work. Address limitations.",
      assignee: "Sam",
      priority: "high",
      deadline: daysFromNow(-8),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 2 },
        { columnId: b3Writing.id, durationDays: 3 },
        { columnId: b3Editing.id, durationDays: 1 },
        { columnId: b3Done.id,    durationDays: 10 },
      ],
      comments: [
        { content: "The limitations paragraph needs to be stronger.", daysAgoPosted: 12 },
        { content: "Expanded the limitations. Looks good now.", daysAgoPosted: 11 },
      ],
    },
    {
      title: "Abstract and introduction",
      description: "Write 250-word abstract and 2-page introduction for the final paper.",
      assignee: "Mia",
      priority: "medium",
      deadline: daysFromNow(-6),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 2 },
        { columnId: b3Editing.id, durationDays: 1 },
        { columnId: b3Done.id,    durationDays: 8 },
      ],
      comments: [
        { content: "Abstract done. Introduction took two full rewrites.", daysAgoPosted: 9 },
        { content: "Approved!", daysAgoPosted: 8 },
      ],
    },
    // LATE: completedAt (daysAgo 3) < deadline (daysAgo 8) — missed by 5 days
    {
      title: "Conclusion and future work",
      description: "Wrap up the paper with a strong conclusion and 3 future directions.",
      assignee: "Sam",
      priority: "medium",
      deadline: daysFromNow(-8),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 3 },
        { columnId: b3Editing.id, durationDays: 2 },
        { columnId: b3Done.id,    durationDays: 3 },
      ],
      comments: [
        { content: "Future work section is weak — need more concrete ideas.", daysAgoPosted: 8 },
        { content: "Expanded with 3 concrete directions. Done.", daysAgoPosted: 4 },
      ],
    },

    // ── In editing ────────────────────────────────────────────
    {
      title: "References and citations",
      description: "Format all references in IEEE style. Check for missing citations.",
      assignee: "Mia",
      priority: "medium",
      deadline: daysFromNow(2),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 3 },
        { columnId: b3Editing.id, durationDays: 2 },
      ],
      comments: [
        { content: "Zotero export to IEEE is mostly clean. A few edge cases to fix.", daysAgoPosted: 3 },
        { content: "Almost done — 2 references still need manual formatting.", daysAgoPosted: 1 },
      ],
    },

    // ── In writing ────────────────────────────────────────────
    {
      title: "Appendix: interview transcripts",
      description: "Anonymise and format the 6 interview transcripts for the appendix.",
      assignee: "Sam",
      priority: "low",
      deadline: daysFromNow(4),
      journey: [
        { columnId: b3LitRev.id,  durationDays: 1 },
        { columnId: b3Writing.id, durationDays: 3 },
      ],
      comments: [
        { content: "Anonymisation is slower than expected — lots of identifying details to scrub.", daysAgoPosted: 2 },
      ],
    },

    // ── In literature review ──────────────────────────────────
    {
      title: "Final proofread and formatting",
      description: "Full paper proofread. Check margins, font sizes, figure numbering, and word count.",
      assignee: "Mia",
      priority: "high",
      deadline: daysFromNow(6),
      journey: [
        { columnId: b3LitRev.id, durationDays: 0 },
      ],
      comments: [
        { content: "Almost there! Just need to verify figure numbering and margins.", daysAgoPosted: 1 },
      ],
    },
    {
      title: "Plagiarism check (Turnitin)",
      description: "Run final paper through Turnitin. Resolve any flagged sections.",
      assignee: "Sam",
      priority: "high",
      deadline: daysFromNow(5),
      journey: [
        { columnId: b3LitRev.id, durationDays: 0 },
      ],
      comments: [],
    },
  ];

  await writeTasks(b3Tasks, b3Done.id, userMap);
  // Add research paper members to board 3
  for (const name of ["Sam", "Mia"]) {
    const uid = userMap.get(name);
    if (uid) await prisma.boardMember.upsert({ where: { userId_boardId: { userId: uid, boardId: b3.id } }, update: {}, create: { userId: uid, boardId: b3.id } });
  }
  console.log(`✓ Seeded board "${b3.name}" with ${b3Tasks.length} tasks across 4 columns.`);
  console.log(`  Board ID: ${b3.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
