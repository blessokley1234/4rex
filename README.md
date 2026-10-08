# 4REX NEWS — Stage 1

Next.js 14 + TypeScript. Dashboard with live candles → indicators → trend score, plus a forex news feed.

## Setup
1. `npm install`
2. `cp .env.example .env.local` and fill in:
   - `TWELVE_DATA_KEY` — https://twelvedata.com. The dashboard requests 9 symbols per refresh (9 API credits). The free plan allows 8 credits/min and 800/day, so use a paid plan for continuous use, or remove symbols in `lib/data.ts`. Check your plan for real-time vs delayed forex/metals and for display/redistribution licensing.
   - `FINNHUB_KEY` — https://finnhub.io (free tier works for news).
3. `npm run dev` → http://localhost:3000 · `npm test` · deploy to Vercel and set the same env vars there (keys stay server-side).

Without keys the UI shows explicit "unavailable" messages. It never shows sample prices.

## How it works
- `lib/indicators.ts` — EMA 20/50/200, RSI(14), MACD(12,26,9), ADX(14), swing-pivot structure, support/resistance, breakouts, weighted score (−100…+100, thresholds ±30).
- `lib/data.ts` — Twelve Data candles, Finnhub news, in-memory TTL cache (serves last good data flagged STALE on errors), weekend detection. Status comes from candle age: LIVE / DELAYED / MARKET CLOSED.
- `app/api/*` — server routes; browser never sees keys.
- Not covered by this stage: DXY (not on Twelve Data's basic plans), Treasury yields, candlestick patterns, backtesting.

## Roadmap (next stages)
2 Lightweight Charts · 3 Scanner (multi-timeframe, filters) · 4 Economic calendar · 5 Gold & Silver centre · 6 Outlook (LLM grounded on retrieved sources) · 7 Supabase auth, watchlist, alerts · 8 Backtest harness for score thresholds.
