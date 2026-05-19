import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/Toasts";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalFetch = window.fetch;
                window.fetch = async function(resource, init) {
                  if (init && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method?.toUpperCase() || '')) {
                    const match = document.cookie.match(new RegExp('(^| )csrf-token=([^;]+)'));
                    if (match) {
                      init.headers = {
                        ...init.headers,
                        'x-csrf-token': match[2]
                      };
                    }
                  }
                  return originalFetch(resource, init);
                };
              }
            `,
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
