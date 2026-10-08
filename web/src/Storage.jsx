import { useEffect, useState } from 'react'
import { call, EP, useMeta } from './api.js'
import { Loading } from './Brand.jsx'
import { Rings } from './Landing.jsx'

const GROUPS = [
  ['gNow', [['temperature_C', 'Temperature', '°C'], ['relative_humidity_pct', 'Humidity', '%'], ['mq135_gas_index', 'Gas index (MQ135)', '']]],
  ['g24', [['avg_temperature_24h_C', 'Avg temperature', '°C'], ['avg_humidity_24h_pct', 'Avg humidity', '%'], ['avg_mq135_24h', 'Avg gas index', ''], ['hours_temp_above_27C_24h', 'Hours above 27 °C', 'h'], ['hours_RH_above_65pct_24h', 'Hours above 65% RH', 'h']]],
  ['gBatch', [['initial_quality_score', 'Initial quality', ''], ['curing_score', 'Curing score', ''], ['storage_day', 'Storage day', 'd']]],
]
const stepOf = (r) => (r.max - r.min <= 1.5 ? 0.01 : r.max - r.min > 50 ? 1 : 0.1)
const PRESETS = [
  ['pHealthy', { temp: .1, hum: .15, gas: .08, hrs: .05, q: .95, day: .15 }],
  ['pWarm', { temp: .85, hum: .85, gas: .5, hrs: .9, q: .5, day: .5 }],
  ['pGas', { temp: .5, hum: .55, gas: .97, hrs: .5, q: .5, day: .6 }],
]
const GROUP_OF = { temperature_C: 'temp', avg_temperature_24h_C: 'temp', relative_humidity_pct: 'hum', avg_humidity_24h_pct: 'hum', mq135_gas_index: 'gas', avg_mq135_24h: 'gas', hours_temp_above_27C_24h: 'hrs', hours_RH_above_65pct_24h: 'hrs', initial_quality_score: 'q', curing_score: 'q', storage_day: 'day' }
const tone = (s) => (/high|spoil|critical|bad|alert|danger/i.test(s) ? 'hot' : /low|safe|good|healthy|fresh/i.test(s) ? '' : 'mid')

export default function Storage({ t }) {
  const { meta, err: metaErr } = useMeta()
  const [v, setV] = useState(null)
  const [variety, setVariety] = useState('')
  const [mode, setMode] = useState('')
  const [res, setRes] = useState(null)
  const [preset, setPreset] = useState('')
  const [err, setErr] = useState('')
  const R = meta?.storage_health.training_ranges

  const defaults = (s) => Object.fromEntries(Object.entries(s.training_ranges).map(([k, r]) => [k, +((r.min + r.max) / 2).toFixed(2)]))
  useEffect(() => {
    if (!meta) return
    const s = meta.storage_health
    setV(defaults(s))
    setVariety(s.varieties[0]); setMode(s.storage_modes[0])
  }, [meta])
  const reset = () => { const s = meta.storage_health; setV(defaults(s)); setVariety(s.varieties[0]); setMode(s.storage_modes[0]); setPreset('') }

  // Live: re-score shortly after any slider or picker changes.
  useEffect(() => {
    if (!v || !variety || !mode) return
    const id = setTimeout(async () => {
      setErr('')
      try { setRes(await call(EP.risk, { ...v, storage_day: Math.round(v.storage_day), variety, storage_mode: mode })) }
      catch (e) { setErr(e.message) }
    }, 400)
    return () => clearTimeout(id)
  }, [v, variety, mode])

  const apply = (k, p) => { setPreset(k); setV(Object.fromEntries(Object.entries(R).map(([k, r]) => [k, +(r.min + p[GROUP_OF[k]] * (r.max - r.min)).toFixed(2)]))) }
  const grp = ([g, fields]) => (
    <fieldset key={g}><legend>{t[g]}</legend>
      {fields.map(([k, label, u]) => (
        <label key={k} className="slide"><span>{label}</span><b>{v[k]} {u}</b>
          <input type="range" min={R[k].min} max={R[k].max} step={stepOf(R[k])} value={v[k]} style={{ '--p': `${((v[k] - R[k].min) / ((R[k].max - R[k].min) || 1)) * 100}%` }} onChange={(e) => { setPreset(''); setV({ ...v, [k]: +e.target.value }) }} /></label>
      ))}
    </fieldset>
  )
  const tn = res ? tone(res.risk) : ''
  return (
    <section className="page wide">
      <h1>{t.storage}</h1>
      {(metaErr || err) && <p className="note err">{t.problem}: {metaErr || err}</p>}
      {!v ? <Loading t={t} /> : (
        <div className="split rev">
          <div>
            <div className="pickers">
              <label>{t.variety}<select value={variety} onChange={(e) => setVariety(e.target.value)}>{meta.storage_health.varieties.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>{t.mode}<select value={mode} onChange={(e) => setMode(e.target.value)}>{meta.storage_health.storage_modes.map((o) => <option key={o}>{o}</option>)}</select></label>
            </div>
            <div className="chips presets"><span>{t.scenario}</span>{PRESETS.map(([k, p]) => <button key={k} className={preset === k ? 'on' : ''} aria-pressed={preset === k} onClick={() => apply(k, p)}>{t[k]}</button>)}<button type="button" className="reset" onClick={reset}>↺ {t.reset}</button></div>
            <div className="fsets"><div className="col">{grp(GROUPS[0])}{grp(GROUPS[2])}</div><div className="col">{grp(GROUPS[1])}</div></div>
          </div>
          <aside className="panel result sticky" aria-live="polite">
            <Rings risk={tn === 'hot'} tone={tn === 'mid' ? 'mid' : ''} />
            {res ? <>
              <div className={'verdict ' + tn}>{res.risk}</div>
              <div className="big">{Math.round(res.shelf_life_days)}<small> {t.shelf}</small></div>
              {Object.entries(res.risk_probabilities).sort((a, b) => b[1] - a[1]).map(([k, p]) => (
                <div key={k} className={'bar ' + tone(k)}><span>{k}</span><i style={{ width: `${Math.round(p * 100)}%` }} /><em>{Math.round(p * 100)}%</em></div>
              ))}
              {res.warnings?.length > 0 && <ul className="warns">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            </> : <Loading t={t} />}
          </aside>
        </div>
      )}
    </section>
  )
}
