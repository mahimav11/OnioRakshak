import { useState } from 'react'

// Sample night: 18:00 -> 06:00. Gas peaks around 03:00 to show the curtain reacting.
const sample = (h) => ({
  temp: 27 - 5 * Math.sin((Math.PI * h) / 12),
  hum: 52 + 14 * Math.sin((Math.PI * h) / 12),
  gas: 100 + 75 * Math.exp(-((h - 9) ** 2) / 3),
})
const clock = (h) => {
  const m = Math.round(((18 + h) % 24) * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function Rings({ risk }) {
  return (
    <svg className={'rings' + (risk ? ' risk' : '')} viewBox="-100 -100 200 200" aria-hidden="true">
      {[88, 72, 57, 43, 30, 18, 8].map((r, i) => (
        <circle key={r} r={r} className="ring" style={{ '--i': i }} />
      ))}
      <circle r="8" className="ping" />
      <circle r="8" className="ping p2" />
      <circle r="3" className="core" />
    </svg>
  )
}

export default function Landing({ t, go }) {
  const [h, setH] = useState(0)
  const v = sample(h)
  const risk = v.gas > 140

  const feats = [['price', 'price', 'priceD'], ['storage', 'storage', 'storageD'], ['chat', 'chat', 'chatD']]
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>{t.h1}</h1>
          <p>{t.sub}</p>
          <div className="actions">
            <button className="btn solid" onClick={() => go('storage')}>{t.open}</button>
            <a className="btn ghost" href="#night">{t.scrub}</a>
          </div>
        </div>
        <div className="hero-art">
          <Rings risk={risk} />
          <div className="chip c1"><span>{t.temp}</span><b>{v.temp.toFixed(1)}°C</b></div>
          <div className="chip c2"><span>{t.hum}</span><b>{Math.round(v.hum)}%</b></div>
          <div className={'chip c3' + (risk ? ' hot' : '')}><span>{t.gas}</span><b>{Math.round(v.gas)} ppm</b></div>
        </div>
      </section>

      <section className="night" id="night">
        <div className="night-text">
          <h2>{t.nightH}</h2>
          <p>{t.nightP}</p>
        </div>
        <div className="panel">
          <div className="clock">{clock(h)}</div>
          <input type="range" min="0" max="12" step="0.25" value={h} onChange={(e) => setH(+e.target.value)} aria-label={t.scrub} />
          <div className="readout">
            <div><span>{t.temp}</span><b>{v.temp.toFixed(1)}°C</b></div>
            <div><span>{t.hum}</span><b>{Math.round(v.hum)}%</b></div>
            <div className={risk ? 'hot' : ''}><span>{t.gas}</span><b>{Math.round(v.gas)} ppm</b></div>
            <div><span>{t.curtain}</span><b>{risk ? 60 : 40}%</b></div>
          </div>
          <div className={'verdict' + (risk ? ' hot' : '')}>{risk ? t.warn : t.ok}</div>
          <small>{t.sample}</small>
        </div>
      </section>

      <section className="feats">
        <h2>{t.featH}</h2>
        <div className="grid">
          {feats.map(([r, a, b]) => (
            <button key={r} className="feat" onClick={() => go(r)}>
              <h3>{t[a]}</h3>
              <p>{t[b]}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
