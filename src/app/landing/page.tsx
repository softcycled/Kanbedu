import { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Kanbedu - Project boards. Without the noise. ",
  description:
    "A lightweight Kanban board platform for student group projects. Built for students, designed for lecturers and teachers",
};

export default function Page() {
  return <LandingPage />;
}
