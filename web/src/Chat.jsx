import { useEffect, useRef, useState } from 'react'
import { call, EP } from './api.js'
import { Logo } from './Brand.jsx'

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Bubble({ m, t }) {
  const [done, setDone] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(m.x).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {}) }
  return (
    <div className={'bub ' + m.r + (m.err ? ' err' : '')}>
      {m.x}
      <span className="meta"><time>{m.at}</time>{m.r === 'bot' && !m.err && <button type="button" className="mini" onClick={copy}>{done ? t.copied : t.copy}</button>}</span>
    </div>
  )
}

export function ChatBox({ t, lang }) {
  const [msgs, setMsgs] = useState([{ r: 'bot', x: t.hello, at: stamp() }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef()
  const inp = useRef()
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs, busy])
  useEffect(() => { inp.current?.focus({ preventScroll: true }) }, [])

  const ask = async (q) => {
    if (!q || busy) return
    setMsgs((m) => [...m, { r: 'me', x: q, at: stamp() }]); setText(''); setBusy(true)
    try {
      const d = await call(EP.chat, { message: q, lang })
      setMsgs((m) => [...m, { r: 'bot', x: d.reply, at: stamp() }])
    } catch (e) { setMsgs((m) => [...m, { r: 'bot', x: `${t.fail} (${e.message})`, err: true, at: stamp() }]) }
    setBusy(false)
    inp.current?.focus({ preventScroll: true })
  }
  return (
    <div className="chatbox">
      <div className="log" role="log" aria-live="polite">
        {msgs.map((m, i) => <Bubble key={i} m={m} t={t} />)}
        {msgs.length === 1 && <div className="chips">{t.chips.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>}
        {busy && <div className="bub bot muted typing" aria-label={t.think}><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(text.trim()) }} className="composer">
        <input ref={inp} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.ask} aria-label={t.ask} maxLength={500} autoComplete="off" />
        <button className="btn solid" disabled={busy || !text.trim()}>{t.send}</button>
        {msgs.length > 1 && <button type="button" className="btn ghost icon-btn" onClick={() => setMsgs([{ r: 'bot', x: t.hello, at: stamp() }])} title={t.clear} aria-label={t.clear}><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></button>}
      </form>
    </div>
  )
}

export default function Chat({ t, lang }) {
  return <section className="page chat"><h1>{t.chat}</h1><ChatBox t={t} lang={lang} /></section>
}

export function ChatWidget({ t, lang }) {
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { const id = setTimeout(() => setShow(true), 1800); return () => clearTimeout(id) }, [])
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open])
  if (!show) return null
  return (
    <div className="widget">
      {open ? (
        <div className="widget-panel" role="dialog" aria-label={t.chat}>
          <div className="widget-head"><Logo size={30} /><b>{t.chat}</b><button onClick={() => setOpen(false)} aria-label={t.close} title="Esc">×</button></div>
          <ChatBox t={t} lang={lang} />
        </div>
      ) : (
        <>
          <div className="greet">{t.hello}</div>
          <button className="launch" onClick={() => setOpen(true)} aria-label={t.chat}><img src="/logo-mark.png" alt="" /></button>
        </>
      )}
    </div>
  )
}
