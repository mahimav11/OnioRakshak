import { useEffect, useState } from 'react'
import { call, EP, useMeta } from './api.js'

const GROUPS = [
  ['gNow', [['temperature_C', 'Temperature', '°C'], ['relative_humidity_pct', 'Humidity', '%'], ['mq135_gas_index', 'Gas index (MQ135)', '']]],
  ['g24', [['avg_temperature_24h_C', 'Avg temperature', '°C'], ['avg_humidity_24h_pct', 'Avg humidity', '%'], ['avg_mq135_24h', 'Avg gas index', ''], ['hours_temp_above_27C_24h', 'Hours above 27 °C', 'h'], ['hours_RH_above_65pct_24h', 'Hours above 65% RH', 'h']]],
  ['gBatch', [['initial_quality_score', 'Initial quality', ''], ['curing_score', 'Curing score', ''], ['storage_day', 'Storage day', 'd']]],
]
const stepOf = (r) => (r.max - r.min <= 1.5 ? 0.01 : r.max - r.min > 50 ? 1 : 0.1)
const tone = (s) => (/high|spoil|critical|bad|alert|danger/i.test(s) ? 'hot' : /low|safe|good|healthy|fresh/i.test(s) ? '' : 'mid')

export default function Storage({ t }) {
  const { meta, err: metaErr } = useMeta()
  const [v, setV] = useState(null)
  const [variety, setVariety] = useState('')
  const [mode, setMode] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const R = meta?.storage_health.training_ranges

  useEffect(() => {
    if (!meta) return
    const s = meta.storage_health
    setV(Object.fromEntries(Object.entries(s.training_ranges).map(([k, r]) => [k, +((r.min + r.max) / 2).toFixed(2)])))
    setVariety(s.varieties[0]); setMode(s.storage_modes[0])
  }, [meta])

  const run = async () => {
    setBusy(true); setErr('')
    try { setRes(await call(EP.risk, { ...v, storage_day: Math.round(v.storage_day), variety, storage_mode: mode })) }
    catch (e) { setRes(null); setErr(e.message) }
    setBusy(false)
  }
  return (
    <section className="page">
      <h1>{t.storage}</h1>
      {(metaErr || err) && <p className="note err">{t.problem}: {metaErr || err}</p>}
      {!v ? <p className="muted">{t.load}</p> : (
        <div className="panel">
          <div className="pickers">
            <label>{t.variety}<select value={variety} onChange={(e) => setVariety(e.target.value)}>{meta.storage_health.varieties.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label>{t.mode}<select value={mode} onChange={(e) => setMode(e.target.value)}>{meta.storage_health.storage_modes.map((o) => <option key={o}>{o}</option>)}</select></label>
          </div>
          {GROUPS.map(([g, fields]) => (
            <fieldset key={g}><legend>{t[g]}</legend>
              {fields.map(([k, label, u]) => (
                <label key={k} className="slide"><span>{label}</span><b>{v[k]} {u}</b>
                  <input type="range" min={R[k].min} max={R[k].max} step={stepOf(R[k])} value={v[k]} onChange={(e) => setV({ ...v, [k]: +e.target.value })} /></label>
              ))}
            </fieldset>
          ))}
          <button className="btn solid" onClick={run} disabled={busy}>{busy ? t.load : t.check}</button>
        </div>
      )}
      {res && (
        <div className="panel result">
          <div className={'verdict ' + tone(res.risk)}>{res.risk}</div>
          <p><b>{Math.round(res.shelf_life_days)}</b> {t.shelf}</p>
          {Object.entries(res.risk_probabilities).sort((a, b) => b[1] - a[1]).map(([k, p]) => (
            <div key={k} className="bar"><span>{k}</span><i style={{ width: `${Math.round(p * 100)}%` }} /><em>{Math.round(p * 100)}%</em></div>
          ))}
          {res.warnings?.length > 0 && <ul className="warns">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      )}
    </section>
  )
}
