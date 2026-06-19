import { describe, it, expect, vi, beforeEach } from 'vitest';

// Access-control regression harness. For each protected route, the acting user
// (B) is NOT a member/owner of the target resource. Every handler must reject
// with 403 (never leak data) and fire the authz-denial log. This locks in the
// membership/ownership checks: a future commit that removes one fails here.

const mockGetVerifiedSession = vi.hoisted(() => vi.fn());
const mockGetClassRole = vi.hoisted(() => vi.fn());
const mockIsMemberOfBoard = vi.hoisted(() => vi.fn());
const mockLogAuthzDenied = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getVerifiedSession: mockGetVerifiedSession,
  getClassRole: mockGetClassRole,
  isMemberOfBoard: mockIsMemberOfBoard,
}));

vi.mock('@/lib/securityLog', () => ({
  logAuthzDenied: mockLogAuthzDenied,
  logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 1, resetDate: new Date() }),
  getClientIp: vi.fn().mockReturnValue('test-ip'),
}));

vi.mock('@/lib/broadcast', () => ({ broadcastToBoard: vi.fn() }));
vi.mock('@/lib/activity', () => ({ recordActivity: vi.fn() }));
vi.mock('@/lib/classNames', () => ({ getBoardNameOverrides: vi.fn().mockResolvedValue({}) }));
vi.mock('@vercel/blob', () => ({ put: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    task: { findUnique: vi.fn() },
    boardMember: { findUnique: vi.fn(), findMany: vi.fn() },
    column: { findUnique: vi.fn() },
    group: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    attachment: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { PATCH as taskPatch } from '@/app/api/tasks/[id]/route';
import { PATCH as boardPatch, DELETE as boardDelete } from '@/app/api/boards/[id]/route';
import { GET as analyticsGet } from '@/app/api/analytics/route';
import { GET as versionsGet } from '@/app/api/tasks/[id]/versions/route';
import { GET as classGet } from '@/app/api/classes/[id]/route';
import { GET as attachGet } from '@/app/api/tasks/[id]/attachments/route';
import { POST as commentPost } from '@/app/api/comments/route';
import { PATCH as columnPatch } from '@/app/api/columns/[id]/route';

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  // Default acting user B, a non-member of everything below.
  mockGetVerifiedSession.mockResolvedValue({ userId: 'userB' });
  mockGetClassRole.mockResolvedValue(null);
  mockIsMemberOfBoard.mockResolvedValue(false);
});

describe('access control: non-member is rejected with 403', () => {
  it('PATCH /api/tasks/[id] — not a board member', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({
      columnRel: { boardId: 'bA', isDone: false, board: { realtimeSecret: 's', members: [] } },
    });
    const res = await taskPatch(jsonReq('http://localhost/api/tasks/tA', 'PATCH', { title: 'x' }) as any, params('tA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('PATCH /api/boards/[id] — not the owner', async () => {
    (prisma.boardMember.findUnique as any).mockResolvedValue(null);
    const res = await boardPatch(jsonReq('http://localhost/api/boards/bA', 'PATCH', { name: 'x' }) as any, params('bA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('DELETE /api/boards/[id] — not the owner', async () => {
    (prisma.boardMember.findUnique as any).mockResolvedValue(null);
    (prisma.group.findUnique as any).mockResolvedValue(null);
    const res = await boardDelete(jsonReq('http://localhost/api/boards/bA', 'DELETE') as any, params('bA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('GET /api/analytics — not a board member', async () => {
    const res = await analyticsGet(jsonReq('http://localhost/api/analytics?boardId=bA', 'GET') as any);
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('GET /api/tasks/[id]/versions — not a board member', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({ columnRel: { boardId: 'bA' } });
    const res = await versionsGet(jsonReq('http://localhost/api/tasks/tA/versions', 'GET') as any, params('tA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('GET /api/classes/[id] — not a class member', async () => {
    const res = await classGet(jsonReq('http://localhost/api/classes/cA', 'GET') as any, params('cA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('GET /api/tasks/[id]/attachments — not a board member', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({ columnRel: { board: { members: [] } } });
    const res = await attachGet(jsonReq('http://localhost/api/tasks/tA/attachments', 'GET') as any, params('tA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('POST /api/comments — not a board member', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({
      columnRel: { boardId: 'bA', board: { realtimeSecret: 's', members: [] } },
    });
    (prisma.user.findUnique as any).mockResolvedValue({ name: 'B', handle: null, email: 'b@t.com' });
    const res = await commentPost(jsonReq('http://localhost/api/comments', 'POST', { taskId: 'tA', content: 'hi' }) as any);
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });

  it('PATCH /api/columns/[id] — not a board member', async () => {
    (prisma.column.findUnique as any).mockResolvedValue({ boardId: 'bA', isDone: false });
    (prisma.boardMember.findUnique as any).mockResolvedValue(null);
    const res = await columnPatch(jsonReq('http://localhost/api/columns/colA', 'PATCH', { label: 'x' }) as any, params('colA'));
    expect(res.status).toBe(403);
    expect(mockLogAuthzDenied).toHaveBeenCalled();
  });
});
