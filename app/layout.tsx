import type { Metadata, Viewport } from "next";
import "@fontsource/dejavu-sans/400.css";
import "@fontsource/dejavu-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "mixer",
  description: "CS2 10-man mix organizer",
};

export const viewport: Viewport = {
  themeColor: "#3a4234",
};

/**
 * Applies the saved CS 1.6 backdrop choice (BackgroundToggle) before the first paint on every
 * page, so it survives navigation and reloads without a flash.
 */
const RESTORE_BACKDROP = `try{if(localStorage.getItem("mixer.background")==="cs16")document.documentElement.dataset.bg="cs16"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RESTORE_BACKDROP }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
