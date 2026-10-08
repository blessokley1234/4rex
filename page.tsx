"use client";
import { useCallback, useEffect, useState } from "react";

const TFS = [["5m","5M"],["15m","15M"],["30m","30M"],["1h","1H"],["4h","4H"],["1d","D"],["1w","W"]];
const cls = (t?: string) => (t === "Bullish" ? "up" : t === "Bearish" ? "down" : "flat");
const STATUS: Record<string, [string, string]> = { live: ["LIVE", "up"], delayed: ["DELAYED", "down"], closed: ["MARKET CLOSED", "flat"], unavailable: ["UNAVAILABLE", "down"] };
const ago = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Spark({ v, c }: { v: number[]; c: string }) {
  const lo = Math.min(...v), hi = Math.max(...v), W = 200, H = 38;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * W},${H - ((x - lo) / (hi - lo || 1)) * (H - 4) - 2}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={`var(--${c})`} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function Home() {
  const [tf, setTf] = useState("1h"), [mk, setMk] = useState<any>(null), [err, setErr] = useState(""), [sel, setSel] = useState("XAUUSD");
  const [news, setNews] = useState<any>(null), [nerr, setNerr] = useState(""), [cur, setCur] = useState("ALL");

  const load = useCallback(async () => {
    try { const r = await fetch("/api/markets?tf=" + tf), j = await r.json(); if (!r.ok) throw new Error(j.error); setMk(j); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }, [tf]);
  useEffect(() => { setMk(null); load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const go = async () => { try { const r = await fetch("/api/news"), j = await r.json(); if (!r.ok) throw new Error(j.error); setNews(j); setNerr(""); } catch (e: any) { setNerr(e.message); } };
    go(); const t = setInterval(go, 120000); return () => clearInterval(t);
  }, []);

  const ins = mk?.instruments?.find((i: any) => i.id === sel);
  const a = ins?.analysis;
  const articles = (news?.articles ?? []).filter((x: any) => cur === "ALL" || x.currencies.includes(cur));

  return (<>
    <header>
      <div className="logo"><svg width="26" height="26" viewBox="0 0 26 26"><rect x="1" y="1" width="24" height="24" rx="6" fill="none" stroke="#232a36" /><path d="M5 18l5-6 4 3 7-9" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>4<b>REX</b></span><small>NEWS</small></div>
      <nav>{["Dashboard","Markets","Scanner","News","Calendar","Gold & Silver","Outlook","Watchlist"].map((n, i) => <span key={n} className={i === 0 ? "on" : "soon"} title={i ? "Coming in a later stage" : ""}>{n}</span>)}</nav>
    </header>
    <div className="hero"><h1>Global Forex Intelligence. Smarter Market Decisions.</h1><p>Trend scores are technical-analysis estimates computed from OHLC candles — not predictions or financial advice.</p></div>
    <main>
      <section>
        <div className="bar">{TFS.map(([k, l]) => <button key={k} className={"chip" + (tf === k ? " on" : "")} onClick={() => setTf(k)}>{l}</button>)}
          {mk && <span className="nm" style={{ marginLeft: "auto" }}>Source: {mk.source} · refreshed {new Date(mk.fetchedAt).toLocaleTimeString()}{mk.stale ? " · STALE (provider error, showing last good data)" : ""}</span>}</div>
        {err && <div className="msg err"><b>Market data unavailable.</b> {err}</div>}
        {!mk && !err && <div className="grid">{Array.from({ length: 9 }, (_, i) => <div className="sk" key={i} />)}</div>}
        {mk && <div className="grid">{mk.instruments.map((i: any, n: number) => {
          const t = i.analysis?.trend, c = cls(t), s = STATUS[i.status];
          if (i.status === "unavailable") return <div className="card" key={i.id}><div className="sym">{i.sym}</div><div className="msg" style={{ marginTop: 8 }}>Data unavailable — {i.reason}</div></div>;
          return <div key={i.id} className={"card" + (sel === i.id ? " sel" : "")} style={{ animationDelay: n * 40 + "ms" }} onClick={() => setSel(i.id)}>
            <div className="row"><div><div className="sym">{i.sym}</div><div className="nm">{i.name}</div></div><span className={"badge " + c}>{t}</span></div>
            <div className="price mono">{i.price.toFixed(i.dp)}</div>
            <div className={"mono " + (i.change >= 0 ? "up" : "down")} style={{ fontSize: 12 }}>{i.change >= 0 ? "+" : ""}{i.change.toFixed(i.dp)} ({i.changePct.toFixed(2)}%) <span className="nm">vs prev. candle</span></div>
            <Spark v={i.spark} c={i.change >= 0 ? "g" : "r"} />
            <div className="meta"><span className={"st " + s[1]}>● {s[0]}</span><span>Score <b className="mono">{a.score > 0 ? "+" : ""}{a.score}</b></span><span>{ago(i.lastCandle)}</span></div>
          </div>; })}</div>}
        {a && <div className="panel" style={{ marginTop: 20 }}>
          <h2>{ins.sym} · {TFS.find((x) => x[0] === tf)?.[1]} analysis</h2>
          <div className="row"><b className={cls(a.trend)} style={{ fontSize: 20 }}>{a.trend}</b><span className="mono">Score {a.score > 0 ? "+" : ""}{a.score} · ADX {isNaN(a.adx) ? "n/a" : a.adx.toFixed(1)} ({a.strength})</span></div>
          <div className="gauge"><i style={{ left: `calc(${(a.score + 100) / 2}% - 1px)` }} /></div>
          {a.coverage < 1 && <div className="msg" style={{ marginBottom: 12 }}>Only {Math.round(a.coverage * 100)}% of the indicator weight could be computed (limited history). Score is renormalised.</div>}
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
            <table><tbody>{a.breakdown.map((b: any) => <tr key={b.key}><td>{b.label}<div className="nm">{b.detail}</div></td><td className={"mono " + (b.points > 0 ? "up" : b.points < 0 ? "down" : "flat")}>{b.points === null ? "n/a" : (b.points > 0 ? "+" : "") + b.points} / {b.weight}</td></tr>)}</tbody></table>
            <div><ul>{a.signals.map((s: any, k: number) => <li key={k} className={s.dir === "bull" ? "up" : s.dir === "bear" ? "down" : "flat"}>{s.dir === "bull" ? "▲" : s.dir === "bear" ? "▼" : "●"} {s.text}</li>)}</ul>
              <div className="meta mono" style={{ marginTop: 12 }}><span>Support {a.support?.toFixed(ins.dp) ?? "—"}</span><span>Resistance {a.resistance?.toFixed(ins.dp) ?? "—"}</span></div></div>
          </div>
          <div className="nm" style={{ marginTop: 12 }}>Calculated {new Date(mk.fetchedAt).toLocaleTimeString()} from {ins.candles} {tf} candles. Weights and thresholds (±30) are configurable in lib/indicators.ts and have not been backtested.</div>
        </div>}
      </section>
      <aside>
        <h2>Global market news</h2>
        <div className="bar">{["ALL","USD","EUR","GBP","JPY","XAU","XAG","OIL"].map((c) => <button key={c} className={"chip" + (cur === c ? " on" : "")} onClick={() => setCur(c)}>{c}</button>)}</div>
        {nerr && <div className="msg err"><b>News unavailable.</b> {nerr}</div>}
        {!news && !nerr && <div className="sk" />}
        {news && !articles.length && <div className="msg">No articles match this filter.</div>}
        {articles.slice(0, 25).map((x: any) => <a key={x.url} className="news" href={x.url} target="_blank" rel="noopener noreferrer">
          <div className="row" style={{ marginBottom: 4 }}><span className="nm">{x.publisher} · {ago(x.time)}</span><span className={"badge " + (x.relevance === "High" ? "down" : x.relevance === "Medium" ? "flat" : "flat")} style={{ fontSize: 9 }}>{x.relevance.toUpperCase()}</span></div>
          <h3>{x.headline}</h3>{x.summary && <p>{x.summary}{x.summary.length >= 280 ? "…" : ""}</p>}
          <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{x.currencies.map((c: string) => <span className="tag" key={c}>{c}</span>)}</div>
        </a>)}
        {news && <div className="nm" style={{ marginTop: 10 }}>Via {news.source}. Relevance is a keyword estimate. Read full stories at the publisher.</div>}
      </aside>
    </main>
    <footer>4REX NEWS provides market information and technical analysis for educational purposes only. It is not personalised financial advice. Trading leveraged products carries a high risk of loss. Data may be delayed or unavailable; always verify prices with your broker.</footer>
  </>);
}
