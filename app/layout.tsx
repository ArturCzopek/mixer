import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource/dejavu-sans/400.css";
import "@fontsource/dejavu-sans/700.css";
import "./globals.css";
import { I18nProvider } from "@/components/i18n";
import { MenuBar } from "@/components/menu-bar";
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
const RESTORE_BACKDROP = `try{if(!document.cookie.includes("mixer.background=")&&localStorage.getItem("mixer.background")==="cs16"){document.cookie="mixer.background=cs16; Max-Age=31536000; Path=/; SameSite=Lax";document.documentElement.dataset.bg="cs16"}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const backdrop = (await cookies()).get("mixer.background")?.value === "cs16";
  return (
    <html
      lang={lang}
      className="h-full"
      data-bg={backdrop ? "cs16" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: RESTORE_BACKDROP }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider lang={lang}>
          <MenuBar initialBackdrop={backdrop} />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
