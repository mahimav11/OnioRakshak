import { useEffect, useState } from 'react'
import { LANGS, T } from './i18n.js'
import Landing from './Landing.jsx'
import Price from './Price.jsx'
import Storage from './Storage.jsx'
import Chat from './Chat.jsx'
import { X } from './extras.js'

const API = import.meta.env.VITE_API_BASE ?? '/api'
const PAGES = ['price', 'storage', 'chat']
const path = () => (location.hash.replace('#/', '') || 'home').split('?')[0]

function Logo() {
  return (
    <svg width="26" height="26" viewBox="-12 -12 24 24" aria-hidden="true">
      {[11, 8, 5, 2].map((r) => <circle key={r} r={r} fill="none" stroke="currentColor" strokeWidth="1.2" />)}
    </svg>
  )
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const [route, setRoute] = useState(path())
  const [up, setUp] = useState(null)
  const t = { ...X.en, ...X[lang], ...T[lang] }

  useEffect(() => {
    const f = () => { setRoute(path()); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  useEffect(() => { localStorage.setItem('lang', lang); document.documentElement.lang = lang }, [lang])
  useEffect(() => {
    // Any answer below 500 means the API answered; the Vite proxy returns 5xx when it is down.
    fetch(`${API}/health`).then((r) => setUp(r.status < 500)).catch(() => setUp(false))
  }, [])

  const go = (r) => { location.hash = r === 'home' ? '#/' : `#/${r}` }

  return (
    <>
      <header className="top">
        <a className="brand" href="#/"><Logo />OnioRakshak</a>
        <nav>
          {PAGES.map((p) => (
            <a key={p} href={`#/${p}`} className={route === p ? 'on' : ''}>{t[p]}</a>
          ))}
        </nav>
        <div className="tools">
          <span className={'status ' + (up === null ? '' : up ? 'up' : 'down')} title={up ? t.up : t.down}>
            <i />{up === null ? '' : up ? t.up : t.down}
          </span>
          <div className="lang">
            {LANGS.map(([c, n]) => (
              <button key={c} className={lang === c ? 'on' : ''} onClick={() => setLang(c)}>{n}</button>
            ))}
          </div>
        </div>
      </header>

      <main>
        {route === 'price' ? <Price t={t} /> : route === 'storage' ? <Storage t={t} /> : route === 'chat' ? <Chat t={t} lang={lang} /> : <Landing t={t} go={go} />}
      </main>
      <footer>{t.foot}</footer>
    </>
  )
}
