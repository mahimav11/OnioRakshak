import { useEffect, useRef, useState } from 'react'

export const Logo = ({ size = 40 }) => <img src="/logo-mark.png" height={size} alt="" className="logo-mark" />

export function Loading({ t }) {
  return (
    <div className="loading" role="status">
      <span className="spin"><i /><i /><img src="/logo-mark.png" alt="" /></span>
      <span>{t.load}</span>
    </div>
  )
}

export function Splash({ gone }) {
  return (
    <div className={'splash' + (gone ? ' gone' : '')} aria-hidden={gone}>
      <div className="splash-in"><i /><i /><i /><img src="/logo-full.png" alt="OnioRakshak" /></div>
    </div>
  )
}

// Tries /images/<slot>.jpg (your own photo), then a remote HD fallback (1x + 2x), then a plain tint.
// Fades in once loaded so images never "pop".
export function Photo({ slot, src, className = '', alt = '' }) {
  const [i, setI] = useState(0)
  const [ok, setOk] = useState(false)
  const list = [`/images/${slot}.jpg`, src]
  const big = typeof src === 'string' ? src.replace(/w=\d+/, (m) => 'w=' + parseInt(m.slice(2), 10) * 2) : ''
  return i < 2
    ? <img className={className + ' photo' + (ok ? ' ready' : '')} src={list[i]} srcSet={i === 1 && big !== src ? `${src} 1x, ${big} 2x` : undefined} alt={alt} loading="lazy" decoding="async"
        onLoad={() => setOk(true)} onError={() => { setOk(false); setI(i + 1) }} />
    : <div className={className + ' ph'} aria-hidden="true" />
}

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !!navigator.connection?.saveData

// Looping, muted HD background video. Starts only while on screen, honours reduced-motion /
// data-saver, has a pause button, and falls back to `children` (an illustration or photo) if it cannot load.
export function Video({ src, poster, className = '', label = '', t = {}, children }) {
  const ref = useRef()
  const [held, setHeld] = useState(calm)     // user (or system) wants it paused
  const [on, setOn] = useState(false)
  const [bad, setBad] = useState(false)
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [bad])
  useEffect(() => {
    const v = ref.current?.querySelector('video')
    if (!v) return
    if (seen && !held) v.play().catch(() => {}); else v.pause()
  }, [seen, held, bad])

  if (bad) return children ?? null
  return (
    <div className={'vid ' + className} ref={ref}>
      <video muted loop playsInline preload="metadata" poster={poster} aria-label={label} aria-hidden={label ? undefined : true}
        onPlaying={() => setOn(true)} onPause={() => setOn(false)}>
        <source src={src} type="video/mp4" onError={() => setBad(true)} />
      </video>
      <button type="button" className="vctl" onClick={() => setHeld(!held)} aria-label={on ? (t.pause || 'Pause video') : (t.play || 'Play video')} aria-pressed={held}>
        {on ? <svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" /></svg> : <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg>}
      </button>
    </div>
  )
}
