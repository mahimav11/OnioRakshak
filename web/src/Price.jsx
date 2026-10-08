import { useEffect, useState } from 'react'
import { call, EP, useMeta } from './api.js'
import { Loading } from './Brand.jsx'

function Chart({ hist, fc, label, t }) {
  const [hv, setHv] = useState(null)
  const [pin, setPin] = useState(null)
  const all = [...hist, ...fc]
  if (all.length < 2) return null
  const vs = all.map((p) => p.price), lo = Math.min(...vs), hi = Math.max(...vs)
  const W = 760, H = 300, P = 44, n = all.length, h = hist.length
  const x = (i) => P + (i * (W - 2 * P)) / (n - 1)
  const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P - 14)
  const path = (pts, off) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i + off)},${y(p.price)}`).join('')
  const join = h ? `M${x(h - 1)},${y(hist[h - 1].price)}` + fc.map((p, i) => `L${x(h + i)},${y(p.price)}`).join('') : ''
  const at = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round((((e.clientX - r.left) / r.width) * W - P) / ((W - 2 * P) / (n - 1)))
    return Math.max(0, Math.min(n - 1, i))
  }
  const cur = pin ?? hv
  const key = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }[e.key]
    if (step) { e.preventDefault(); setPin(null); setHv(Math.max(0, Math.min(n - 1, (cur ?? n - 1) + step))) }
    else if (e.key === 'Escape') { setPin(null); setHv(null) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPin(pin == null ? (cur ?? n - 1) : null) }
  }
  const p = cur != null ? all[cur] : null
  const txt = p ? `${p.date} · ${Math.round(p.price)}${cur >= h ? ` (${t.fc})` : ''}` : ''
  const right = p && x(cur) > W / 2
  const tw = txt.length * 7.4 + 20
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" tabIndex={0} aria-label={`${label}. ${t.pin}`}
      onPointerMove={(e) => pin == null && setHv(at(e))} onPointerLeave={() => setHv(null)} onPointerDown={(e) => { if (e.pointerType !== 'mouse') setHv(at(e)) }}
      onClick={(e) => { const i = at(e); setPin(pin === i ? null : i); setHv(i) }} onKeyDown={key} onBlur={() => { setHv(null) }}>
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--c1)" }} stopOpacity=".22" /><stop offset="1" style={{ stopColor: "var(--c1)" }} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return <g key={i}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="grid-l" /><text x={P - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g> })}
      {h > 0 && <rect x={x(h - 1)} y={10} width={W - P - x(h - 1)} height={H - P - 10} className="fc-zone" />}
      <path d={`${path(hist, 0)}L${x(h - 1)},${H - P}L${x(0)},${H - P}Z`} fill="url(#ga)" />
      <path d={path(hist, 0)} className="l-hist" /><path d={join} className="l-fc" />
      <text x={P} y={H - 12}>{all[0].date}</text><text x={W - P} y={H - 12} textAnchor="end">{all.at(-1).date}</text>
      {p && <g><line x1={x(cur)} x2={x(cur)} y1={10} y2={H - P} className="cross" /><circle cx={x(cur)} cy={y(p.price)} r="5.5" className={(cur >= h ? 'dot-fc' : 'dot-h') + (pin != null ? ' pinned' : '')} />
        <rect x={right ? x(cur) - 12 - tw : x(cur) + 12} y={8} width={tw} height={26} rx="8" className="tipbox" />
        <text x={right ? x(cur) - 12 - tw / 2 : x(cur) + 12 + tw / 2} y={26} textAnchor="middle" className="tip">{txt}</text></g>}
    </svg>
  )
}

export default function Price({ t }) {
  const { meta, err: metaErr } = useMeta()
  const [market, setMarket] = useState('')
  const [variety, setVariety] = useState('')
  const [days, setDays] = useState(14)
  const [win, setWin] = useState(90)
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const markets = meta?.price.markets ?? {}
  const maxDays = meta?.price.max_days_ahead ?? 30

  useEffect(() => { if (meta && !market) { const m = Object.keys(markets).find((k) => k.startsWith('Lasalgaon')) ?? Object.keys(markets)[0]; setMarket(m); setVariety(markets[m][0]) } }, [meta])
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
  const up = d && d.change_pct >= 0
  return (
    <section className="page wide">
      <h1>{t.price}</h1>
      {(metaErr || err) && <p className="note err">{t.problem}: {metaErr || err}</p>}
      <div className="split">
        <div className="panel ctl sticky">
          <label>{t.market}<select value={market} onChange={(e) => onMarket(e.target.value)}>{Object.keys(markets).map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>{t.variety}<select value={variety} onChange={(e) => setVariety(e.target.value)}>{(markets[market] ?? []).map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="slide"><span>{t.days}</span><b>{days}</b><input type="range" min="1" max={maxDays} value={days} style={{ '--p': `${((days - 1) / (maxDays - 1 || 1)) * 100}%` }} onChange={(e) => setDays(+e.target.value)} /></label>
          <div className="chips seg" role="group" aria-label={t.days}>{[7, 14, 30].filter((x) => x <= maxDays).map((x) => <button key={x} type="button" className={days === x ? 'on' : ''} aria-pressed={days === x} onClick={() => setDays(x)}>{x}{t.dUnit}</button>)}</div>
          <div className="seg-l">{t.range}</div>
          <div className="chips seg" role="group" aria-label={t.range}>{[30, 60, 90].map((x) => <button key={x} type="button" className={win === x ? 'on' : ''} aria-pressed={win === x} onClick={() => setWin(x)}>{x}{t.dUnit}</button>)}</div>
        </div>
        <div>
          {!d && !err && <Loading t={t} />}
          {d && <>
            <div className="kpi4">
              <div><span>{t.latest}</span><b>₹{Math.round(d.last_price)}</b></div>
              <div><span>{t.in} {days} {t.dayUnit}</span><b className={up ? 'up' : 'dn'}>₹{Math.round(d.forecast.at(-1)?.price ?? 0)}</b></div>
              <div><span>{t.change}</span><b className={up ? 'up' : 'dn'}>{up ? '▲ +' : '▼ '}{d.change_pct.toFixed(1)}%</b></div>
              <div><span>{t.trend}</span><b>{trendLbl[d.trend] ?? d.trend}</b></div>
            </div>
            <div className="panel chart-panel">
              <Chart hist={d.history.slice(-win)} fc={d.forecast} label={t.fc} t={t} />
              <div className="legend"><i className="k-h" />{t.hist}<i className="k-f" />{t.fc}<small>{t.unit} · {t.upto} {d.last_data_date}</small></div>
              {d.note && <p className="muted">{d.note}</p>}
            </div>
          </>}
        </div>
      </div>
    </section>
  )
}
