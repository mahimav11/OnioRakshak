import { useEffect, useRef, useState } from 'react'
import { call, EP } from './api.js'

export default function Chat({ t, lang }) {
  const [msgs, setMsgs] = useState([{ r: 'bot', x: t.hello }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const send = async (e) => {
    e.preventDefault()
    const q = text.trim()
    if (!q || busy) return
    setMsgs((m) => [...m, { r: 'me', x: q }]); setText(''); setBusy(true)
    try {
      const d = await call(EP.chat, { message: q, lang })
      setMsgs((m) => [...m, { r: 'bot', x: d.reply }])
    } catch (e) { setMsgs((m) => [...m, { r: 'bot', x: `${t.fail} (${e.message})`, err: true }]) }
    setBusy(false)
  }
  return (
    <section className="page chat">
      <h1>{t.chat}</h1>
      <div className="log">
        {msgs.map((m, i) => <div key={i} className={'bub ' + m.r + (m.err ? ' err' : '')}>{m.x}</div>)}
        {busy && <div className="bub bot muted">{t.think}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.ask} aria-label={t.ask} />
        <button className="btn solid" disabled={busy}>{t.send}</button>
      </form>
    </section>
  )
}
