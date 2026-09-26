import type { Metadata, Viewport } from "next";
import "@fontsource/dejavu-sans/400.css";
import "@fontsource/dejavu-sans/700.css";
import "./globals.css";
import { I18nProvider } from "@/components/i18n";
import { getLang } from "@/lib/i18n/server";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RESTORE_BACKDROP }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
