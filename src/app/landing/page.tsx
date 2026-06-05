import { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Kanbedu - Track your group projects without the noise",
  description:
    "The free, minimal Kanban board built for students and educators. Drag-and-drop task boards, team assignments, built-in analytics, class monitoring, and one-click invites.",
};

export default function Page() {
  return <LandingPage />;
}
