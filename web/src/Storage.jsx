import { useState } from 'react'
import { call, EP, pick } from './api.js'

const localRisk = (v) => { const s = (v.gas > 150) + (v.temp > 30) + (v.hum > 75); return s >= 2 ? 'high' : s === 1 ? 'mid' : 'low' }

export default function Storage({ t }) {
  const [v, setV] = useState({ temp: 26, hum: 60, gas: 110 })
  const [res, setRes] = useState(null)
  const set = (k) => (e) => setV({ ...v, [k]: +e.target.value })

  const run = async () => {
    try {
      const d = await call(EP.risk, { method: 'POST', body: { temperature: v.temp, humidity: v.hum, gas: v.gas } })
      const raw = String(pick(d, ['risk', 'label', 'status', 'prediction'], '')).toLowerCase()
      setRes({ k: /high|spoil|alert|2/.test(raw) ? 'high' : /mid|med|watch|1/.test(raw) ? 'mid' : 'low', local: false })
    } catch { setRes({ k: localRisk(v), local: true }) }
  }
  const F = [['temp', t.temp, 10, 45, '°C'], ['hum', t.hum, 20, 100, '%'], ['gas', t.gas, 50, 400, 'ppm']]
  return (
    <section className="page">
      <h1>{t.storage}</h1>
      <div className="panel">
        {F.map(([k, label, min, max, u]) => (
          <label key={k} className="slide"><span>{label}</span><b>{v[k]} {u}</b>
            <input type="range" min={min} max={max} value={v[k]} onChange={set(k)} /></label>
        ))}
        <button className="btn solid" onClick={run}>{t.check}</button>
        {res && <div className={'verdict ' + (res.k === 'low' ? '' : res.k === 'high' ? 'hot' : 'mid')}>{t[res.k === 'mid' ? 'mid' : res.k]}{res.local && <small> · {t.local}</small>}</div>}
      </div>
    </section>
  )
}
