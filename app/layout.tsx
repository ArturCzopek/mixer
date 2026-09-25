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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
