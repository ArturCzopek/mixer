/**
 * A mix's number within its group, counted from the oldest mix (#1), so it never changes when a
 * newer mix is created. `newestFirst` is the group's mixes ordered by created_at descending.
 */
export function mixNumber(
  newestFirst: { id: string }[],
  mixId: string,
): number {
  const index = newestFirst.findIndex((item) => item.id === mixId);
  return index < 0 ? newestFirst.length + 1 : newestFirst.length - index;
}
