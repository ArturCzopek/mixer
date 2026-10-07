/** Observed scores only: no inferred overtime, comeback or historical skill. */
export function resultQuip(maps: { a: number; b: number }[]) {
  if (!maps.length) return null;
  if (maps.every((map) => Math.abs(map.a - map.b) <= 2)) return "closeGame";
  if (maps.some((map) => Math.abs(map.a - map.b) >= 10)) return "stomp";
  if (maps.some((map) => map.a > map.b) && maps.some((map) => map.b > map.a))
    return "splitEvening";
  return null;
}
