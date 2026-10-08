import { useEffect, useState } from 'react'
import { LANGS, T } from './i18n.js'
import Landing from './Landing.jsx'
import Price from './Price.jsx'
import Storage from './Storage.jsx'
import Chat, { ChatWidget } from './Chat.jsx'
import Auth from './Auth.jsx'
import { getSession, setSession, clearSession } from './auth.js'
import { Logo, Splash } from './Brand.jsx'
import { X, Y } from './extras.js'

const API = import.meta.env.VITE_API_BASE ?? '/api'
const PAGES = ['price', 'storage', 'chat']
const path = () => (location.hash.replace('#/', '') || 'home').split('?')[0]

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const [route, setRoute] = useState(path())
  const [up, setUp] = useState(null)
  const [boot, setBoot] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState(getSession())
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  const t = { ...X.en, ...Y.en, ...X[lang], ...Y[lang], ...T[lang] }

  useEffect(() => {
    const f = () => { setRoute(path()); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  useEffect(() => { localStorage.setItem('lang', lang); document.documentElement.lang = lang }, [lang])
  useEffect(() => { const id = setTimeout(() => setBoot(false), 1200); return () => clearTimeout(id) }, [])
  useEffect(() => { localStorage.setItem('theme', theme); document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    // Any answer below 500 means the API answered; the Vite proxy returns 5xx when it is down.
    fetch(`${API}/health`).then((r) => setUp(r.status < 500)).catch(() => setUp(false))
  }, [])

  useEffect(() => {
    const f = () => setScrolled(scrollY > 12)
    f(); addEventListener('scroll', f, { passive: true })
    return () => removeEventListener('scroll', f)
  }, [])
  // Gentle scroll-reveal: elements fade in once as they enter the viewport.
  useEffect(() => {
    const root = document.documentElement
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { root.classList.remove('rv'); return }
    root.classList.add('rv')
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    const id = setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el)), 60)
    return () => { clearTimeout(id); io.disconnect() }
  }, [route])

  const go = (r) => { location.hash = r === 'home' ? '#/' : `#/${r}` }

  return (
    <>
      <Splash gone={!boot} />
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>{t.skip}</a>
      <header className={'top' + (scrolled ? ' lifted' : '')}>
        <a className="brand" href="#/"><span className="tile"><Logo size={34} /></span>OnioRakshak</a>
        <nav aria-label="Main">
          {PAGES.map((p) => (
            <a key={p} href={`#/${p}`} className={route === p ? 'on' : ''} aria-current={route === p ? 'page' : undefined}>{t[p]}</a>
          ))}
        </nav>
        <div className="tools">
          <span className={'status ' + (up === null ? '' : up ? 'up' : 'down')} title={up ? t.up : t.down}>
            <i />{up === null ? '' : up ? t.up : t.down}
          </span>
          {user
            ? <span className="who">{user.name.split(' ')[0]}<button onClick={() => { clearSession(); setUser(null); go('home') }}>{t.logout}</button></span>
            : <><a className="btn ghost sm" href="#/login">{t.login}</a><a className="btn solid sm" href="#/signup">{t.signup}</a></>}
          <button className="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark'
            ? <svg viewBox="0 0 24 24" className="ti"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg viewBox="0 0 24 24" className="ti"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>}</button>
          <div className="lang" role="group" aria-label="Language">
            {LANGS.map(([c, n]) => (
              <button key={c} className={lang === c ? 'on' : ''} aria-pressed={lang === c} onClick={() => setLang(c)}>{n}</button>
            ))}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {route === 'login' || route === 'signup' ? <Auth t={t} mode={route} lang={lang} go={go} onAuth={(u) => { setSession(u); setUser(u); if (u.lang) setLang(u.lang); go('storage') }} /> : route === 'price' ? <Price t={t} /> : route === 'storage' ? <Storage t={t} /> : route === 'chat' ? <Chat t={t} lang={lang} /> : <Landing t={t} go={go} />}
      </main>
      <footer><span className="tile"><Logo size={28} /></span>{t.foot}</footer>
      <button className={'totop' + (scrolled ? ' show' : '')} onClick={() => scrollTo({ top: 0 })} aria-label={t.top} title={t.top} tabIndex={scrolled ? 0 : -1}><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6" /></svg></button>
      {route !== 'chat' && <ChatWidget t={t} lang={lang} />}
    </>
  )
}
