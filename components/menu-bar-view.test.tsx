import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n";
import { MenuBarView } from "./menu-bar-view";

const router = vi.hoisted(() => ({ path: "/g/beta/m/mix-1" }));

vi.mock("next/navigation", () => ({
  usePathname: () => router.path,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

function render(me: Parameters<typeof MenuBarView>[0]["me"]) {
  return renderToStaticMarkup(
    I18nProvider({
      lang: "en",
      children: createElement(MenuBarView, {
        auth: true,
        me,
        groups: [
          { id: "a", slug: "alpha", name: "Alpha" },
          { id: "b", slug: "beta", name: "Beta" },
        ],
        initialBackdrop: false,
      }),
    }),
  );
}

describe("header profile link", () => {
  it("uses the current group for a signed-in player", () => {
    router.path = "/g/beta/m/mix-1";
    const html = render({
      name: "Player",
      steamId: "76561197960551471",
      avatarUrl: null,
      isSiteAdmin: false,
    });
    expect(html).toContain('href="/g/beta/p/76561197960551471"');
    expect(html).toContain("My Profile");
  });

  it("uses the first group outside a group page and hides the link for guests", () => {
    router.path = "/";
    const signedIn = render({
      name: "Player",
      steamId: "76561197960551471",
      avatarUrl: null,
      isSiteAdmin: false,
    });
    expect(signedIn).toContain('href="/g/alpha/p/76561197960551471"');
    expect(render(null)).not.toContain("My Profile");
  });
});
