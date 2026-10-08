import { analyze, Candle } from "./indicators";

export const INSTRUMENTS = [
  { id: "EURUSD", sym: "EUR/USD", name: "Euro / US Dollar", dp: 5 },
  { id: "GBPUSD", sym: "GBP/USD", name: "British Pound / US Dollar", dp: 5 },
  { id: "USDJPY", sym: "USD/JPY", name: "US Dollar / Japanese Yen", dp: 3 },
  { id: "USDCHF", sym: "USD/CHF", name: "US Dollar / Swiss Franc", dp: 5 },
  { id: "AUDUSD", sym: "AUD/USD", name: "Australian Dollar / US Dollar", dp: 5 },
  { id: "NZDUSD", sym: "NZD/USD", name: "New Zealand Dollar / US Dollar", dp: 5 },
  { id: "USDCAD", sym: "USD/CAD", name: "US Dollar / Canadian Dollar", dp: 5 },
  { id: "XAUUSD", sym: "XAU/USD", name: "Gold / US Dollar", dp: 2 },
  { id: "XAGUSD", sym: "XAG/USD", name: "Silver / US Dollar", dp: 3 },
];
export const TF: Record<string, { td: string; min: number }> = {
  "5m": { td: "5min", min: 5 }, "15m": { td: "15min", min: 15 }, "30m": { td: "30min", min: 30 },
  "1h": { td: "1h", min: 60 }, "4h": { td: "4h", min: 240 }, "1d": { td: "1day", min: 1440 }, "1w": { td: "1week", min: 10080 },
};

const cache = new Map<string, { at: number; data: any }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try { const data = await fn(); cache.set(key, { at: Date.now(), data }); return data; }
  catch (e) { if (hit) return { ...(hit.data as any), stale: true }; throw e; } // serve last good data, flagged stale
}

// Forex is closed roughly Fri 22:00 UTC -> Sun 22:00 UTC
function marketClosed(d = new Date()) {
  const day = d.getUTCDay(), h = d.getUTCHours();
  return (day === 5 && h >= 22) || day === 6 || (day === 0 && h < 22);
}

export async function getMarkets(tf: string) {
  const key = process.env.TWELVE_DATA_KEY;
  if (!key) throw new Error("TWELVE_DATA_KEY is not configured. Add it to .env.local (see .env.example).");
  const cfg = TF[tf] ?? TF["1h"];
  const ttl = Math.min(Math.max(60, cfg.min * 12), 900) * 1000;
  return cached(`mk:${tf}`, ttl, async () => {
    const url = `https://api.twelvedata.com/time_series?symbol=${INSTRUMENTS.map((i) => i.sym).join(",")}&interval=${cfg.td}&outputsize=260&order=ASC&timezone=UTC&apikey=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (json.status === "error" && !json["EUR/USD"]) throw new Error(`Twelve Data: ${json.message}`);
    const instruments = INSTRUMENTS.map((ins) => {
      const base = { id: ins.id, sym: ins.sym, name: ins.name, dp: ins.dp };
      const s = json[ins.sym];
      if (!s || s.status === "error" || !s.values?.length)
        return { ...base, status: "unavailable", reason: s?.message ?? "No data returned" };
      const cs: Candle[] = s.values.map((v: any) => ({ t: Date.parse(v.datetime.replace(" ", "T") + "Z"), o: +v.open, h: +v.high, l: +v.low, c: +v.close }));
      const last = cs.at(-1)!, prev = cs.at(-2) ?? last;
      const age = Date.now() - last.t;
      const status = age <= cfg.min * 60000 * 1.5 + 120000 ? "live" : marketClosed() ? "closed" : "delayed";
      return {
        ...base, status, price: last.c, change: last.c - prev.c, changePct: ((last.c - prev.c) / prev.c) * 100,
        lastCandle: last.t, candles: cs.length, spark: cs.slice(-60).map((x) => x.c), analysis: analyze(cs),
      };
    });
    return { tf, source: "Twelve Data", fetchedAt: Date.now(), instruments };
  });
}

const CUR: [string, RegExp][] = [
  ["USD", /dollar|\bfed\b|federal reserve|treasur|\busd\b|powell/i], ["EUR", /\beuro\b|\becb\b|\beur\b|lagarde/i],
  ["GBP", /pound|sterling|\bboe\b|bank of england|\bgbp\b/i], ["JPY", /\byen\b|\bboj\b|bank of japan|\bjpy\b/i],
  ["CHF", /franc|\bsnb\b/i], ["AUD", /aussie|\brba\b|australia/i], ["CAD", /loonie|bank of canada|\bcad\b/i],
  ["XAU", /\bgold\b|bullion/i], ["XAG", /\bsilver\b/i], ["OIL", /\boil\b|crude|opec|brent/i],
];
const HIGH = /rate decision|rate cut|rate hike|\bcpi\b|inflation|non-?farm|payrolls|\bfomc\b|\bfed\b|\becb\b|\bboe\b|\bboj\b|emergency/i;
const MED = /\bgdp\b|unemployment|jobs|yield|central bank|tariff|gold|oil|retail sales|pmi/i;

export async function getNews() {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new Error("FINNHUB_KEY is not configured. Add it to .env.local (see .env.example).");
  return cached("news", 120000, async () => {
    const get = async (cat: string) => {
      const r = await fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=${key}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Finnhub ${r.status}`);
      return (await r.json()) as any[];
    };
    const [fx, gen] = await Promise.all([get("forex"), get("general")]);
    const seen = new Set<string>();
    const articles = [...fx, ...gen].filter((a) => a.headline && a.url && !seen.has(a.url) && seen.add(a.url))
      .sort((a, b) => b.datetime - a.datetime).slice(0, 60).map((a) => {
        const text = `${a.headline} ${a.summary ?? ""}`;
        return {
          headline: a.headline, summary: (a.summary ?? "").slice(0, 280), publisher: a.source, url: a.url, time: a.datetime * 1000,
          currencies: CUR.filter(([, re]) => re.test(text)).map(([c]) => c),
          relevance: HIGH.test(text) ? "High" : MED.test(text) ? "Medium" : "Low", // keyword heuristic, not a forecast
        };
      });
    return { source: "Finnhub", fetchedAt: Date.now(), articles };
  });
}
