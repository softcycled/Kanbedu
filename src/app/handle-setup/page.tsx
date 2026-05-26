import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HandleSetupForm from "./HandleSetupForm";

export const dynamic = "force-dynamic";

export default async function HandleSetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // If the user already has a handle, no need to be here
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { handle: true },
  });
  if (user?.handle) redirect("/");

  return <HandleSetupForm />;
}
