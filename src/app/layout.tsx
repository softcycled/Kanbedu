import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanbedu",
  description: "Lightweight kanban for student group projects",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
