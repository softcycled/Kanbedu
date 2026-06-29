import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetVerifiedSession = vi.hoisted(() => vi.fn());
const mockGetClassRole = vi.hoisted(() => vi.fn());
const mockIsClassArchived = vi.hoisted(() => vi.fn());
const mockSendClassInviteEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getVerifiedSession: mockGetVerifiedSession,
  getClassRole: mockGetClassRole,
  isClassArchived: mockIsClassArchived,
}));

vi.mock('@/lib/email', () => ({
  sendClassInviteEmail: mockSendClassInviteEmail,
}));

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/classBoards', () => ({
  createGroupBoard: vi.fn(),
  coercePreset: vi.fn().mockReturnValue({ columns: [], tasks: [] }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    classRosterEntry: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    group: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    classPreset: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ hits: 1, expiresAt: new Date(Date.now() + 60000) }),
      update: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/classes/[id]/import/route';

function csvFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

function makeRequest(body: FormData): Request {
  return new Request('http://localhost/api/classes/c1/import', {
    method: 'POST',
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.classRosterEntry.findMany as any).mockResolvedValue([]);
  (prisma.user.findMany as any).mockResolvedValue([]);
  (prisma.class.findUnique as any).mockResolvedValue({ name: 'Test Class', joinCode: 'ABC123' });
  mockIsClassArchived.mockResolvedValue(false);
  mockSendClassInviteEmail.mockResolvedValue(undefined);
});

describe('POST /api/classes/[id]/import', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetVerifiedSession.mockResolvedValue(null);
    const form = new FormData();
    form.append('file', csvFile('name,email\nAlice,alice@test.com'));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is a student', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('student');
    const form = new FormData();
    form.append('file', csvFile('name,email\nAlice,alice@test.com'));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 when CSV exceeds 100-row limit', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('educator');
    const rows = ['name,email'];
    for (let i = 1; i <= 101; i++) rows.push(`Student ${i},student${i}@test.com`);
    const form = new FormData();
    form.append('file', csvFile(rows.join('\n')));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('100');
  });

  it('sends invite emails only to new roster entries', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('educator');
    // alice is already on the roster; bob is new
    (prisma.classRosterEntry.findMany as any).mockResolvedValue([{ email: 'alice@test.com' }]);

    const form = new FormData();
    form.append('file', csvFile('name,email\nAlice,alice@test.com\nBob,bob@test.com'));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only Bob is new — Alice is already on roster
    expect(body.invited).toBe(1);
    expect(mockSendClassInviteEmail).toHaveBeenCalledTimes(1);
    expect(mockSendClassInviteEmail).toHaveBeenCalledWith(
      'bob@test.com', 'Bob', 'Test Class', expect.stringContaining('ABC123')
    );
  });

  it('returns inviteFailed count when email sending fails', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('educator');
    mockSendClassInviteEmail.mockRejectedValue(new Error('Brevo down'));

    const form = new FormData();
    form.append('file', csvFile('name,email\nAlice,alice@test.com'));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invited).toBe(0);
    expect(body.inviteFailed).toBe(1);
  });

  it('caps invite emails at 100 per import and reports inviteCapped', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('educator');

    const rows = ['name,email'];
    for (let i = 1; i <= 100; i++) rows.push(`Student ${i},student${i}@test.com`);
    const form = new FormData();
    form.append('file', csvFile(rows.join('\n')));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(100);
    expect(body.inviteCapped).toBe(0); // 100 rows, cap is 100 — no overage
    expect(mockSendClassInviteEmail).toHaveBeenCalledTimes(100);
  });

  it('returns 400 when CSV has no email column', async () => {
    mockGetVerifiedSession.mockResolvedValue({ userId: 'u1' });
    mockGetClassRole.mockResolvedValue('educator');
    const form = new FormData();
    form.append('file', csvFile('name,phone\nAlice,555-1234'));
    const res = await POST(makeRequest(form) as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect(res.status).toBe(400);
  });
});
