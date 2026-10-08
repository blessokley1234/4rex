import { describe, it, expect } from "vitest";
import { ema, rsi, analyze, Candle } from "../lib/indicators";
// Synthetic fixtures for logic tests only. NOT market data.
const mk = (f: (i: number) => number, n = 260): Candle[] =>
  Array.from({ length: n }, (_, i) => { const c = f(i); return { t: i * 6e4, o: c, h: c + 0.4, l: c - 0.4, c }; });
describe("indicators", () => {
  it("EMA of a constant is that constant", () => expect(ema(Array(50).fill(5), 20).at(-1)).toBeCloseTo(5));
  it("RSI of a monotonic rise is 100", () => expect(rsi(Array.from({ length: 40 }, (_, i) => i)).at(-1)).toBe(100));
});
describe("trend engine", () => {
  const wave = (i: number) => Math.sin(i / 4);
  it("classifies a steady uptrend as Bullish", () => expect(analyze(mk((i) => 100 + i * 0.5 + wave(i))).trend).toBe("Bullish"));
  it("classifies a steady downtrend as Bearish", () => expect(analyze(mk((i) => 300 - i * 0.5 + wave(i))).trend).toBe("Bearish"));
  it("classifies a sideways range as Neutral", () => expect(analyze(mk((i) => 100 + 2 * wave(i))).trend).toBe("Neutral"));
  it("keeps score within -100..100 and reports reduced coverage on short history", () => {
    const a = analyze(mk((i) => 100 + i, 60));
    expect(Math.abs(a.score)).toBeLessThanOrEqual(100);
    expect(a.coverage).toBeLessThan(1);
  });
});
