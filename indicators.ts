export type Candle = { t: number; o: number; h: number; l: number; c: number };
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export function ema(v: number[], p: number): number[] {
  const out = Array(v.length).fill(NaN);
  if (v.length < p) return out;
  const k = 2 / (p + 1);
  let e = avg(v.slice(0, p));
  out[p - 1] = e;
  for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
export function rsi(c: number[], p = 14): number[] {
  const out = Array(c.length).fill(NaN);
  if (c.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); }
  g /= p; l /= p;
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
export function macd(c: number[]) {
  const f = ema(c, 12), s = ema(c, 26);
  const line = c.map((_, i) => f[i] - s[i]);
  const first = 25;
  const signal = [...Array(first).fill(NaN), ...ema(line.slice(first), 9)];
  return { line, signal, hist: line.map((x, i) => x - signal[i]) };
}
export function adx(cs: Candle[], p = 14): number {
  const n = cs.length;
  if (n < 2 * p + 1) return NaN;
  let trS = 0, pS = 0, mS = 0;
  const dx: number[] = [];
  for (let i = 1; i < n; i++) {
    const up = cs[i].h - cs[i - 1].h, dn = cs[i - 1].l - cs[i].l;
    const tr = Math.max(cs[i].h - cs[i].l, Math.abs(cs[i].h - cs[i - 1].c), Math.abs(cs[i].l - cs[i - 1].c));
    const pd = up > dn && up > 0 ? up : 0, md = dn > up && dn > 0 ? dn : 0;
    if (i <= p) { trS += tr; pS += pd; mS += md; }
    else { trS = trS - trS / p + tr; pS = pS - pS / p + pd; mS = mS - mS / p + md; }
    if (i >= p) { const pi = (100 * pS) / trS, mi = (100 * mS) / trS; dx.push((100 * Math.abs(pi - mi)) / (pi + mi || 1)); }
  }
  let a = avg(dx.slice(0, p));
  for (let i = p; i < dx.length; i++) a = (a * (p - 1) + dx[i]) / p;
  return a;
}
export function pivots(cs: Candle[], k = 3) {
  const hi: { i: number; p: number }[] = [], lo: { i: number; p: number }[] = [];
  for (let i = k; i < cs.length - k; i++) {
    let H = true, L = true;
    for (let j = 1; j <= k; j++) {
      if (cs[i].h <= cs[i - j].h || cs[i].h <= cs[i + j].h) H = false;
      if (cs[i].l >= cs[i - j].l || cs[i].l >= cs[i + j].l) L = false;
    }
    if (H) hi.push({ i, p: cs[i].h });
    if (L) lo.push({ i, p: cs[i].l });
  }
  return { hi, lo };
}

export const DEFAULT_CFG = {
  weights: { p50: 15, p200: 15, e2050: 15, e50200: 10, rsi: 15, macd: 15, structure: 15 } as Record<string, number>,
  bull: 30, bear: -30,
};
export type Trend = "Bullish" | "Bearish" | "Neutral";

export function analyze(cs: Candle[], cfg = DEFAULT_CFG) {
  const n = cs.length, c = cs.map((x) => x.c), last = c[n - 1];
  const E = (p: number) => ema(c, p)[n - 1];
  const e20 = E(20), e50 = E(50), e200 = E(200);
  const r = rsi(c)[n - 1], m = macd(c), mh = m.hist[n - 1];
  const a = adx(cs), pv = pivots(cs);
  const f = (x: number, d = 5) => (isNaN(x) ? "n/a" : x.toFixed(d));
  const comps: { key: string; label: string; v: number | null; detail: string }[] = [];
  const add = (key: string, label: string, v: number | null, detail: string) => comps.push({ key, label, v, detail });
  const rel = (x: number, y: number, d: string) => (isNaN(x) || isNaN(y) ? null : Math.sign(x - y));
  add("p50", "Price vs EMA 50", rel(last, e50, ""), `EMA50 ${f(e50)}`);
  add("p200", "Price vs EMA 200", rel(last, e200, ""), `EMA200 ${f(e200)}`);
  add("e2050", "EMA 20 vs EMA 50", rel(e20, e50, ""), `EMA20 ${f(e20)}`);
  add("e50200", "EMA 50 vs EMA 200", rel(e50, e200, ""), "Long-term bias");
  add("rsi", "RSI (14)", isNaN(r) ? null : Math.max(-1, Math.min(1, (r - 50) / 20)), `RSI ${f(r, 1)}`);
  add("macd", "MACD vs signal", isNaN(mh) ? null : Math.sign(mh), `Histogram ${f(mh, 6)}`);
  let st: number | null = null, stTxt = "Not enough swing points";
  if (pv.hi.length >= 2 && pv.lo.length >= 2) {
    const hh = pv.hi.at(-1)!.p > pv.hi.at(-2)!.p, hl = pv.lo.at(-1)!.p > pv.lo.at(-2)!.p;
    st = hh && hl ? 1 : !hh && !hl ? -1 : 0;
    stTxt = hh && hl ? "Higher highs + higher lows" : !hh && !hl ? "Lower highs + lower lows" : "Mixed swing structure";
  }
  add("structure", "Price structure", st, stTxt);

  let used = 0, sum = 0;
  const breakdown = comps.map((x) => {
    const w = cfg.weights[x.key] ?? 0;
    if (x.v !== null) { used += w; sum += w * x.v; }
    return { ...x, weight: w, points: x.v === null ? null : +(w * x.v).toFixed(1) };
  });
  const score = used ? Math.round((100 * sum) / used) : 0;
  const trend: Trend = score > cfg.bull ? "Bullish" : score < cfg.bear ? "Bearish" : "Neutral";
  const strength = isNaN(a) ? "Unknown" : a >= 40 ? "Very strong" : a >= 25 ? "Strong" : a >= 20 ? "Developing" : "Weak / ranging";

  const signals: { dir: "bull" | "bear" | "neutral"; text: string }[] = [];
  breakdown.forEach((b) => b.v && signals.push({ dir: b.v > 0 ? "bull" : "bear", text: `${b.label}: ${b.detail}` }));
  if (r > 70) signals.push({ dir: "neutral", text: "RSI overbought (>70)" });
  if (r < 30) signals.push({ dir: "neutral", text: "RSI oversold (<30)" });
  const prev = cs.slice(-21, -1);
  if (prev.length === 20) {
    if (last > Math.max(...prev.map((x) => x.h))) signals.push({ dir: "bull", text: "Breakout above 20-candle high" });
    if (last < Math.min(...prev.map((x) => x.l))) signals.push({ dir: "bear", text: "Breakdown below 20-candle low" });
  }
  const recent = (arr: typeof pv.hi) => arr.filter((x) => x.i > n - 120).map((x) => x.p);
  const support = Math.max(-Infinity, ...recent(pv.lo).filter((p) => p < last));
  const resistance = Math.min(Infinity, ...recent(pv.hi).filter((p) => p > last));
  return {
    score, trend, strength, adx: a, rsi: r, breakdown, signals,
    coverage: used / 100, // <1 means not enough candles for some indicators
    support: isFinite(support) ? support : null,
    resistance: isFinite(resistance) ? resistance : null,
    ema: { e20, e50, e200 },
  };
}
