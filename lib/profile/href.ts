/** Use the group in the current route, or the first (main) group in the switcher order. */
export function myProfileHref(
  path: string,
  groups: readonly { slug: string }[],
  steamId: string,
): string | null {
  const currentSlug = /^\/g\/([^/]+)/.exec(path)?.[1];
  const group = groups.find((item) => item.slug === currentSlug) ?? groups[0];
  return group ? `/g/${group.slug}/p/${steamId}` : null;
}
