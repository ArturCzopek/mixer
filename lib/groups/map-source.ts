export type MapSource = "faceit" | "popflash" | "manual" | "demo";

/**
 * Where a map's numbers come from, for source counts. Recorded stats win over how the score was
 * entered: a manual map enriched from FACEIT or a demo counts as FACEIT or demo.
 */
export function mapSource(map: {
  source: string;
  stats_origin: string | null;
}): string {
  return map.stats_origin ?? map.source;
}

export function countMapSources(
  maps: { source: string; stats_origin: string | null }[],
): Record<MapSource, number> {
  const counts: Record<MapSource, number> = {
    faceit: 0,
    popflash: 0,
    manual: 0,
    demo: 0,
  };
  for (const map of maps) {
    const source = mapSource(map);
    if (source in counts) counts[source as MapSource]++;
  }
  return counts;
}
