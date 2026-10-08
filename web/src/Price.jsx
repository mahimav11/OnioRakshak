import { useEffect, useState } from 'react'
import { call, EP, MARKETS, VARIETIES, pick, series } from './api.js'

const demo = (seed) => {
  const mk = (n, from) => Array.from({ length: n }, (_, i) => ({ d: '', v: Math.round(1500 + seed * 60 + 260 * Math.sin((i + from) / 5) + (i + from) * 4) }))
  return { hist: mk(40, 0), fc: mk(14, 40), upto: '31 Dec 2025' }
}

function Chart({ hist, fc, t }) {
  const all = [...hist, ...fc]
  if (!all.length) return null
  const lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v))
  const W = 760, H = 280, P = 36
  const x = (i) => P + (i * (W - 2 * P)) / (all.length - 1)
  const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P)
  const line = (pts, off) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i + off)},${y(p.v)}`).join('')
  const join = hist.length ? `M${x(hist.length - 1)},${y(hist[hist.length - 1].v)}` + fc.map((p, i) => `L${x(hist.length + i)},${y(p.v)}`).join('') : ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t.fc}>
      {[0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return <g key={i}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="grid-l" /><text x={P - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g> })}
      <rect x={x(hist.length - 1)} y={P / 2} width={W - P - x(hist.length - 1)} height={H - 1.5 * P} className="fc-zone" />
      <path d={line(hist, 0)} className="l-hist" />
      <path d={join} className="l-fc" />
    </svg>
  )
}

export default function Price({ t }) {
  const [market, setMarket] = useState(MARKETS[0])
  const [variety, setVariety] = useState(VARIETIES[0])
  const [data, setData] = useState(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    setData(null)
    call(EP.forecast, { params: { market, variety } })
      .then((d) => { setData({ hist: series(pick(d, ['history', 'past', 'historical'], [])), fc: series(pick(d, ['forecast', 'predictions', 'future'], [])), upto: pick(d, ['data_until', 'last_date', 'as_of'], '31 Dec 2025') }); setFallback(false) })
      .catch(() => { setData(demo(MARKETS.indexOf(market) + VARIETIES.indexOf(variety))); setFallback(true) })
  }, [market, variety])

  const last = data?.fc.at(-1)?.v, now = data?.hist.at(-1)?.v
  return (
    <section className="page">
      <h1>{t.price}</h1>
      <div className="pickers">
        <label>{t.market}<select value={market} onChange={(e) => setMarket(e.target.value)}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>{t.variety}<select value={variety} onChange={(e) => setVariety(e.target.value)}>{VARIETIES.map((m) => <option key={m}>{m}</option>)}</select></label>
      </div>
      {!data ? <p className="muted">{t.load}</p> : <>
        <div className="panel">
          <div className="kpis">
            <div><span>{t.hist}</span><b>{now ? Math.round(now) : '-'}</b></div>
            <div><span>{t.fc}</span><b className={last > now ? 'up' : 'dn'}>{last ? Math.round(last) : '-'}</b></div>
            <small>{t.unit}</small>
          </div>
          <Chart hist={data.hist} fc={data.fc} t={t} />
          <small>{t.upto} {data.upto}</small>
        </div>
        {fallback && <p className="note">{t.sampleData}</p>}
      </>}
    </section>
  )
}
