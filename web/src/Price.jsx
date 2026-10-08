import { useEffect, useState } from 'react'
import { call, EP, useMeta } from './api.js'

function Chart({ hist, fc, label }) {
  const all = [...hist, ...fc]
  if (all.length < 2) return null
  const vs = all.map((p) => p.price), lo = Math.min(...vs), hi = Math.max(...vs)
  const W = 760, H = 280, P = 40
  const x = (i) => P + (i * (W - 2 * P)) / (all.length - 1)
  const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P)
  const path = (pts, off) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i + off)},${y(p.price)}`).join('')
  const h = hist.length
  const join = h ? `M${x(h - 1)},${y(hist[h - 1].price)}` + fc.map((p, i) => `L${x(h + i)},${y(p.price)}`).join('') : ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      {[0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return <g key={i}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="grid-l" /><text x={P - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g> })}
      {h > 0 && <rect x={x(h - 1)} y={P / 2} width={W - P - x(h - 1)} height={H - 1.5 * P} className="fc-zone" />}
      <path d={path(hist, 0)} className="l-hist" /><path d={join} className="l-fc" />
      <text x={P} y={H - 8}>{all[0].date}</text><text x={W - P} y={H - 8} textAnchor="end">{all.at(-1).date}</text>
    </svg>
  )
}

export default function Price({ t }) {
  const { meta, err: metaErr } = useMeta()
  const [market, setMarket] = useState('')
  const [variety, setVariety] = useState('')
  const [days, setDays] = useState(14)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  const markets = meta?.price.markets ?? {}
  const maxDays = meta?.price.max_days_ahead ?? 30
  useEffect(() => { if (meta && !market) { const m = Object.keys(markets)[0]; setMarket(m); setVariety(markets[m][0]) } }, [meta])
  useEffect(() => {
    if (!market || !variety) return
    const id = setTimeout(() => {
      setErr('')
      call(EP.price, { market, variety, days_ahead: days }).then(setD).catch((e) => { setD(null); setErr(e.message) })
    }, 250)
    return () => clearTimeout(id)
  }, [market, variety, days])

  const onMarket = (m) => { setMarket(m); if (!markets[m].includes(variety)) setVariety(markets[m][0]) }
  const trendLbl = { rising: t.rising, falling: t.falling, steady: t.steady }
  return (
    <section className="page">
      <h1>{t.price}</h1>
      {(metaErr || err) && <p className="note err">{t.problem}: {metaErr || err}</p>}
      <div className="pickers">
        <label>{t.market}<select value={market} onChange={(e) => onMarket(e.target.value)}>{Object.keys(markets).map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>{t.variety}<select value={variety} onChange={(e) => setVariety(e.target.value)}>{(markets[market] ?? []).map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>{t.days}: {days}<input type="range" min="1" max={maxDays} value={days} onChange={(e) => setDays(+e.target.value)} /></label>
      </div>
      {!d && !err && <p className="muted">{t.load}</p>}
      {d && (
        <div className="panel">
          <div className="kpis">
            <div><span>{t.latest}</span><b>{Math.round(d.last_price)}</b></div>
            <div><span>{t.in} {days} {t.dayUnit}</span><b className={d.change_pct >= 0 ? 'up' : 'dn'}>{Math.round(d.forecast.at(-1)?.price ?? 0)}</b></div>
            <div><span>{t.change}</span><b className={d.change_pct >= 0 ? 'up' : 'dn'}>{d.change_pct > 0 ? '+' : ''}{d.change_pct.toFixed(1)}%</b></div>
            <div><span>{t.trend}</span><b>{trendLbl[d.trend] ?? d.trend}</b></div>
            <small>{t.unit}</small>
          </div>
          <Chart hist={d.history.slice(-90)} fc={d.forecast} label={t.fc} />
          <small>{t.upto} {d.last_data_date}</small>
          {d.note && <p className="muted">{d.note}</p>}
        </div>
      )}
    </section>
  )
}
