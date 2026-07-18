import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/Toasts";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://kanbedu.com"),
  title: "Kanbedu",
  description: "A lightweight Kanban board platform for student group projects. Built for students, designed for lecturers and teachers.",
  openGraph: {
    title: "Kanbedu",
    description: "A lightweight Kanban board platform for student group projects. Built for students, designed for lecturers and teachers.",
    siteName: "Kanbedu",
    type: "website",
    images: [
      {
        url: "/screenshots/RealPreview.png",
        width: 1896,
        height: 860,
        alt: "Kanbedu classroom kanban board",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kanbedu",
    description: "A lightweight Kanban board platform for student group projects. Built for students, designed for lecturers and teachers.",
    images: ["/screenshots/RealPreview.png"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Kanbedu",
              url: "https://kanbedu.com/",
            }),
          }}
        />
        <script
          nonce={nonce}
          suppressHydrationWarning
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
