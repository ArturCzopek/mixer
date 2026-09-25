// Scoring rules for probabilistic predictions (pure).

export interface Prediction {
  /** Predicted probability that team 1 wins. */
  p: number;
  /** 1 if team 1 won, 0 otherwise. */
  y: 0 | 1;
}

const EPS = 1e-6;
const clampP = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));

/** Mean negative log-likelihood; a coin flip scores ln 2 ≈ 0.693, lower is better. */
export function logLoss(preds: Prediction[]): number {
  return (
    preds.reduce(
      (s, { p, y }) => s - (y ? Math.log(clampP(p)) : Math.log(1 - clampP(p))),
      0,
    ) / preds.length
  );
}

/** Mean squared error of the probability; a coin flip scores 0.25, lower is better. */
export function brier(preds: Prediction[]): number {
  return preds.reduce((s, { p, y }) => s + (p - y) ** 2, 0) / preds.length;
}

/** Share of maps where the favourite (p ≠ 0.5) won; ties are skipped. */
export function favouriteWinRate(preds: Prediction[]): {
  rate: number;
  n: number;
} {
  const decided = preds.filter(({ p }) => Math.abs(p - 0.5) > 1e-9);
  const hits = decided.filter(({ p, y }) => (p > 0.5 ? y === 1 : y === 0));
  return {
    rate: decided.length ? hits.length / decided.length : NaN,
    n: decided.length,
  };
}

/** Predicted vs actual win rate of the favourite, bucketed by favourite probability. */
export function calibration(
  preds: Prediction[],
  edges = [0.5, 0.55, 0.6, 0.7, 1.0001],
): {
  from: number;
  to: number;
  n: number;
  predicted: number;
  actual: number;
}[] {
  const fav = preds.map(({ p, y }) =>
    p >= 0.5 ? { p, y } : { p: 1 - p, y: (1 - y) as 0 | 1 },
  );
  return edges.slice(0, -1).map((from, i) => {
    const to = edges[i + 1];
    const inBucket = fav.filter((x) => x.p >= from && x.p < to);
    const n = inBucket.length;
    return {
      from,
      to: Math.min(to, 1),
      n,
      predicted: n ? inBucket.reduce((s, x) => s + x.p, 0) / n : NaN,
      actual: n ? inBucket.reduce((s, x) => s + x.y, 0) / n : NaN,
    };
  });
}

/** Spearman rank correlation (average ranks for ties). */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 3) return NaN;
  const rank = (v: number[]) => {
    const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const [rx, ry] = [rank(xs), rank(ys)];
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const [mx, my] = [mean(rx), mean(ry)];
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}
