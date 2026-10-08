import { useEffect, useState } from 'react'
import { login, signup } from './auth.js'
import { NightScene } from './Scenes.jsx'
import { Rings } from './Landing.jsx'

const DISTRICTS = ['Ahilyanagar', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar', 'Dharashiv', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal']
const LANGS = [['mr', 'मराठी'], ['hi', 'हिन्दी'], ['en', 'English']]
function Pass({ t, ...p }) {
  const [on, setOn] = useState(false)
  return <span className="passwrap"><input {...p} type={on ? 'text' : 'password'} /><button type="button" className="eye" onClick={() => setOn(!on)} aria-label={on ? t.hide : t.show} aria-pressed={on} tabIndex={-1}>{on ? t.hide : t.show}</button></span>
}
const Field = ({ label, error, children }) => <label className="field"><span>{label}</span>{children}{error && <em className="err-t" role="alert">{error}</em>}</label>

export default function Auth({ t, mode, go, onAuth, lang }) {
  const [f, setF] = useState({ name: '', age: '', phone: '', village: '', district: 'Nashik', qty: '', cap: '', lang, pass: '', pass2: '', consent: false })
  const [lg, setLg] = useState({ phone: '', pass: '' })
  const [step, setStep] = useState(0)
  const [err, setErr] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const need = (v) => (String(v).trim() ? '' : t.eReq)
  const rules = [
    () => ({ name: need(f.name), age: +f.age >= 14 && +f.age <= 100 ? '' : t.eAge, phone: /^[6-9]\d{9}$/.test(f.phone) ? '' : t.ePhone }),
    () => ({ village: need(f.village), qty: +f.qty > 0 ? '' : t.eReq, cap: +f.cap > 0 ? '' : t.eReq }),
    () => ({ pass: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(f.pass) ? '' : t.ePass, pass2: f.pass === f.pass2 ? '' : t.eMatch, consent: f.consent ? '' : t.eConsent }),
  ]
  const check = () => { const bad = Object.fromEntries(Object.entries(rules[step]()).filter(([, v]) => v)); setErr(bad); return !Object.keys(bad).length }

  useEffect(() => { const id = setTimeout(() => document.querySelector('.face:not([inert]) input')?.focus(), 500); return () => clearTimeout(id) }, [mode, step])

  const doLogin = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('')
    try { onAuth(await login(lg.phone.trim(), lg.pass)) } catch { setMsg(t.eBad) }
    setBusy(false)
  }
  const doSignup = async (e) => {
    e.preventDefault()
    if (!check()) return
    setBusy(true); setMsg('')
    const { pass2, consent, pass, ...p } = f
    try { onAuth(await signup({ ...p, age: +p.age, qty: +p.qty, cap: +p.cap, password: pass })) }
    catch (x) { setMsg(/exists/.test(x.message) ? t.eExists : x.message) }
    setBusy(false)
  }
  const other = mode === 'login' ? 'signup' : 'login'
  return (
    <section className="auth">
      <div className="auth-art"><NightScene /></div>
      <div className="auth-stage">
        <Rings key={mode} />
        <div className={'flip' + (mode === 'signup' ? ' is-signup' : '')}>
          <form className="face panel" onSubmit={doLogin} inert={mode !== 'login'} noValidate>
            <h1>{t.welcomeBack}</h1>
            <Field label={t.phone}><input inputMode="numeric" autoComplete="tel" maxLength={10} value={lg.phone} onChange={(e) => setLg({ ...lg, phone: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label={t.pass}><Pass t={t} autoComplete="current-password" value={lg.pass} onChange={(e) => setLg({ ...lg, pass: e.target.value })} /></Field>
            {mode === 'login' && msg && <p className="note err" role="alert">{msg}</p>}
            <button className="btn solid wide-btn" disabled={busy}>{t.login}</button>
            <p className="swap">{t.noAcc} <button type="button" className="link" onClick={() => { setMsg(''); go(other) }}>{t.signup}</button></p>
          </form>

          <form className="face back panel" onSubmit={doSignup} inert={mode !== 'signup'} noValidate>
            <h1>{t.joinH}</h1>
            <ol className="steps">{[t.s1, t.s2, t.s3].map((s, i) => <li key={i} className={i === step ? 'on' : i < step ? 'done' : ''}><i>{i + 1}</i>{s}</li>)}</ol>
            {step === 0 && <>
              <Field label={t.name} error={err.name}><input autoComplete="name" value={f.name} onChange={set('name')} /></Field>
              <div className="two">
                <Field label={t.age} error={err.age}><input inputMode="numeric" value={f.age} onChange={set('age')} /></Field>
                <Field label={t.phone} error={err.phone}><input inputMode="numeric" autoComplete="tel" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} /></Field>
              </div></>}
            {step === 1 && <>
              <Field label={t.village} error={err.village}><input value={f.village} onChange={set('village')} /></Field>
              <Field label={t.district}><select value={f.district} onChange={set('district')}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
              <div className="two">
                <Field label={t.qty} error={err.qty}><input inputMode="decimal" value={f.qty} onChange={set('qty')} /></Field>
                <Field label={t.cap} error={err.cap}><input inputMode="decimal" value={f.cap} onChange={set('cap')} /></Field>
              </div></>}
            {step === 2 && <>
              <Field label={t.langPref}><select value={f.lang} onChange={set('lang')}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field>
              <Field label={t.pass} error={err.pass}><Pass t={t} autoComplete="new-password" value={f.pass} onChange={set('pass')} /></Field>
              <Field label={t.pass2} error={err.pass2}><Pass t={t} autoComplete="new-password" value={f.pass2} onChange={set('pass2')} /></Field>
              <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} /><span>{t.consent}</span></label>
              {err.consent && <em className="err-t" role="alert">{err.consent}</em>}
              <small>{t.privacy}</small></>}
            {mode === 'signup' && msg && <p className="note err" role="alert">{msg}</p>}
            <div className="actions nav-row">
              {step > 0 && <button type="button" className="btn ghost" onClick={() => { setErr({}); setStep(step - 1) }}>{t.back}</button>}
              {step < 2 ? <button type="button" className="btn solid" onClick={() => check() && setStep(step + 1)}>{t.next}</button> : <button className="btn solid" disabled={busy}>{t.create}</button>}
            </div>
            <p className="swap">{t.haveAcc} <button type="button" className="link" onClick={() => { setMsg(''); go(other) }}>{t.login}</button></p>
          </form>
        </div>
        <small className="demo">{t.demo}</small>
      </div>
    </section>
  )
}
