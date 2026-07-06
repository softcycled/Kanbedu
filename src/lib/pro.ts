import { prisma } from "@/lib/prisma";

// Lecturer Pro entitlement check. `proUntil` is the single source of truth:
// null or in the past = free, in the future = Pro. No status enum to drift
// from Stripe. See spec_pro_billing memory for the full billing design.

export async function isProUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { proUntil: true },
  });
  return !!user?.proUntil && user.proUntil > new Date();
}

// Class-scoped gates (archive, clone, export, class limit) check the class
// OWNER's entitlement, so a TA in a Pro educator's class is never blocked
// and a free educator can't borrow Pro by TA-ing in someone else's class.
export async function isProClass(classId: string): Promise<boolean> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { owner: { select: { proUntil: true } } },
  });
  return !!cls?.owner.proUntil && cls.owner.proUntil > new Date();
}
