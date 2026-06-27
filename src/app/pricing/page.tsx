import { Metadata } from "next";
import PricingPage from "@/components/PricingPage";

export const metadata: Metadata = {
  title: "Pricing - Kanbedu",
  description:
    "Kanbedu is free for students and teachers. Lecturer Pro adds room to scale for larger cohorts. Join the early-access waitlist.",
};

export default function Page() {
  return <PricingPage />;
}
