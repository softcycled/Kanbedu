import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/Toasts";

export const metadata: Metadata = {
  title: "Kanbedu",
  description: "Kanban boards built for the classroom",
  openGraph: {
    title: "Kanbedu",
    description: "Kanban boards built for the classroom",
    siteName: "Kanbedu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kanbedu",
    description: "Kanban boards built for the classroom",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')return;document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-paper text-ink">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
