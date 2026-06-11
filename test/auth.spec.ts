import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock auth and prisma before importing route handlers
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  isMemberOfBoard: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    column: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    boardMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    board: {
      findUnique: vi.fn(),
    },
    tag: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    classMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    taskAssignee: {
      deleteMany: vi.fn(),
    },
    // Rate limiter reads the DB ledger; resolve as a fresh bucket so routes
    // under test never get throttled.
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ hits: 1, expiresAt: new Date(Date.now() + 60000) }),
      update: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

// Now import the mocked modules and the route handlers
import { prisma } from '@/lib/prisma';
import * as auth from '@/lib/auth';

import * as taskRoute from '@/app/api/tasks/[id]/route';
import * as columnsRoute from '@/app/api/columns/route';
import * as boardsRoute from '@/app/api/boards/route';
import * as boardsIdRoute from '@/app/api/boards/[id]/route';
import * as membersRoute from '@/app/api/boards/[id]/members/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Authorization - integration (light)', () => {
  it('DELETE /api/tasks/[id] returns 401 when no session', async () => {
    (auth.getSession as any).mockResolvedValue(null);

    const req = new Request('http://localhost/api/tasks/1', { method: 'DELETE' });
    const res: any = await taskRoute.DELETE(req as any, { params: { id: '1' } } as any);
    expect(res.status).toBe(401);
  });

  it('DELETE /api/tasks/[id] returns 403 when user is not a board member', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    (prisma.task.findUnique as any).mockResolvedValue({ columnRel: { boardId: 'b1' } });
    (auth.isMemberOfBoard as any).mockResolvedValue(false);

    const req = new Request('http://localhost/api/tasks/1', { method: 'DELETE' });
    const res: any = await taskRoute.DELETE(req as any, { params: { id: '1' } } as any);
    expect(res.status).toBe(403);
  });

  it('PUT /api/boards returns 401 when not authenticated', async () => {
    (auth.getSession as any).mockResolvedValue(null);
    const req = new Request('http://localhost/api/boards', { method: 'PUT', body: JSON.stringify({ ids: ['b1'] }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await boardsRoute.PUT(req as any);
    expect(res.status).toBe(401);
  });

  it('PUT /api/boards returns 403 when user is not member of affected boards', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    (prisma.boardMember.findMany as any).mockResolvedValue([]);
    const req = new Request('http://localhost/api/boards', { method: 'PUT', body: JSON.stringify({ ids: ['b1'] }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await boardsRoute.PUT(req as any);
    expect(res.status).toBe(403);
  });

  it('POST /api/columns returns 401 when not authenticated', async () => {
    (auth.getSession as any).mockResolvedValue(null);
    const req = new Request('http://localhost/api/columns', { method: 'POST', body: JSON.stringify({ label: 'X', boardId: 'b1' }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await columnsRoute.POST(req as any);
    expect(res.status).toBe(401);
  });

  it('POST /api/columns returns 403 when user is not a member', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    (auth.isMemberOfBoard as any).mockResolvedValue(false);
    const req = new Request('http://localhost/api/columns', { method: 'POST', body: JSON.stringify({ label: 'X', boardId: 'b1' }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await columnsRoute.POST(req as any);
    expect(res.status).toBe(403);
  });

  it('DELETE /api/boards/[id] returns 403 when user is not owner', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    (prisma.boardMember.findUnique as any).mockResolvedValue({ id: 'm1', role: 'member' });
    const req = new Request('http://localhost/api/boards/b1', { method: 'DELETE' });
    const res: any = await boardsIdRoute.DELETE(req as any, { params: { id: 'b1' } } as any);
    expect(res.status).toBe(403);
  });

  it('POST /api/boards/[id]/members transfer returns 403 for non-owner', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    (prisma.boardMember.findUnique as any).mockResolvedValue({ id: 'm1', role: 'member' });
    const req = new Request('http://localhost/api/boards/b1/members', { method: 'POST', body: JSON.stringify({ action: 'transfer', toUserId: 'u2' }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await membersRoute.POST(req as any, { params: { id: 'b1' } } as any);
    expect(res.status).toBe(403);
  });

  it('PATCH /api/columns (reorder) rejects cross-board columns', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    // columns found belong to different boards
    (prisma.column.findMany as any).mockResolvedValue([
      { id: 'c1', boardId: 'b1' },
      { id: 'c2', boardId: 'b2' },
    ]);

    const body = { columns: [{ id: 'c1', order: 1 }, { id: 'c2', order: 2 }] };
    const req = new Request('http://localhost/api/columns', { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const res: any = await columnsRoute.PATCH(req as any);
    expect(res.status).toBe(400);
  });

  it('PATCH /api/tasks/[id] moving to a dest column in another board returns 400', async () => {
    (auth.getSession as any).mockResolvedValue({ userId: 'u1' });
    // First call: taskAuth check
    (prisma.task.findUnique as any).mockResolvedValueOnce({ columnRel: { boardId: 'b1' } });
    // Second call: fetch current
    (prisma.task.findUnique as any).mockResolvedValueOnce({ id: 't1', title: 't', description: '', column: 'c1', assigneeId: null, assignees: [], priority: null, order: 0, completedAt: null, tags: [] });
    // dest column belongs to a different board
    (prisma.column.findUnique as any).mockResolvedValue({ id: 'cX', boardId: 'b2' });

    // user is member of source board but not dest board
    (auth.isMemberOfBoard as any).mockImplementation(async (userId: string, boardId: string) => {
      return boardId === 'b1';
    });

    const req = new Request('http://localhost/api/tasks/t1', { method: 'PATCH', body: JSON.stringify({ column: 'cX' }), headers: { 'Content-Type': 'application/json' } });
    const res: any = await taskRoute.PATCH(req as any, { params: { id: 't1' } } as any);
    // Cross-board moves are rejected outright (same-board rule) before the
    // dest-board membership check — 400, not 403.
    expect(res.status).toBe(400);
  });
});
