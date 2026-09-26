// Voting outcome (pure). One vote per player per mix; voting for another variant moves the vote.
// Ties between the top variants are broken by a random pick seeded with the mix id, so every
// viewer sees the same winner and it never changes on reload (D33).

export interface VoteCount {
  number: number;
  votes: number;
}

export interface VotingOutcome {
  winner: number;
  /** Variant numbers tied for the most votes (length > 1 means a random tie-break). */
  tied: number[];
}

/** FNV-1a hash of the seed, for a stable "random" index. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function votingOutcome(
  variants: VoteCount[],
  seed: string,
): VotingOutcome {
  if (variants.length === 0) throw new Error("No variants");
  const top = Math.max(...variants.map((v) => v.votes));
  const tied = variants
    .filter((v) => v.votes === top)
    .map((v) => v.number)
    .sort((a, b) => a - b);
  return { winner: tied[hash(seed) % tied.length], tied };
}
