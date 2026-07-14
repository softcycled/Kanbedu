"use client";

import { useParams } from "next/navigation";
import PublicBoardView from "@/components/PublicBoardView";

export default function PublicPreviewPage() {
  const params = useParams();
  const token = params.token as string;

  return <PublicBoardView token={token} />;
}
