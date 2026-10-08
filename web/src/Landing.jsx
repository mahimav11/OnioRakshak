import { useState } from 'react'
import { Photo, Video } from './Brand.jsx'
import { NightScene, FieldScene } from './Scenes.jsx'

// Verified free HD footage from Pexels (loops, muted). Posters show instantly while the video loads.
const VID = {
  hero: { src: 'https://videos.pexels.com/video-files/12201142/12201142-hd_1080_1920_60fps.mp4', poster: 'https://images.pexels.com/videos/12201142/pexels-photo-12201142.jpeg?auto=compress&cs=tinysrgb&w=1200' },
  day: { src: 'https://videos.pexels.com/video-files/14319118/14319118-uhd_2560_1440_60fps.mp4', poster: 'https://images.pexels.com/videos/14319118/4k-video-free-download-free-video-download-imad-clicks-14319118.jpeg?auto=compress&cs=tinysrgb&w=1600' },
  cta: { src: 'https://videos.pexels.com/video-files/34841999/14769471_1920_1080_30fps.mp4', poster: 'https://images.pexels.com/videos/34841999/pexels-photo-34841999.jpeg?auto=compress&cs=tinysrgb&w=1600' },
}
const PX = (id, w = 1000) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`
const sample = (h) => ({ temp: 27 - 5 * Math.sin((Math.PI * h) / 12), hum: 52 + 14 * Math.sin((Math.PI * h) / 12), gas: 100 + 75 * Math.exp(-((h - 9) ** 2) / 3) })
const clock = (h) => { const m = Math.round(((18 + h) % 24) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
const ICONS = ['M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z', 'M12 10C12 4 17 4 17 7s-3 3-5 3zM14 12c6 0 6 5 3 5s-3-3-3-5zM12 14c0 6-5 6-5 3s3-3 5-3zM10 12C4 12 4 7 7 7s3 3 3 5z', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', 'M4 18l5-6 4 3 7-9M16 6h4v4', 'M6 17v-6a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21h4', 'M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3']

export function Rings({ risk, tone = '' }) {
  return (
    <svg className={'rings' + (risk ? ' risk' : '') + (tone ? ' ' + tone : '')} viewBox="-100 -100 200 200" aria-hidden="true">
      {[88, 72, 57, 43, 30, 18, 8].map((r, i) => <circle key={r} r={r} className="ring" style={{ '--i': i }} />)}
      <circle r="8" className="ping" /><circle r="8" className="ping p2" /><circle r="3" className="core" />
    </svg>
  )
}

export default function Landing({ t, go }) {
  const [h, setH] = useState(0)
  const v = sample(h), risk = v.gas > 140
  const feats = [['price', 'priceD', 'f1', 33913094], ['storage', 'storageD', 'f2', 16701914], ['chat', 'chatD', 'f3', 4307386]]
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>{t.h1}</h1>
          <p>{t.sub}</p>
          <div className="actions">
            <button className="btn solid" onClick={() => go('signup')}>{t.signup}</button>
            <a className="btn ghost" href="#night">{t.scrub}</a>
          </div>
        </div>
        <div className="hero-art">
          <Rings risk={risk} />
          <div className="arch"><Video {...VID.hero} t={t} label="Aerial view of green crop fields"><NightScene /></Video></div>
          <div className="chip c1"><span>{t.temp}</span><b>{v.temp.toFixed(1)}°C</b></div>
          <div className="chip c2"><span>{t.hum}</span><b>{Math.round(v.hum)}%</b></div>
          <div className={'chip c3' + (risk ? ' hot' : '')}><span>{t.gas}</span><b>{Math.round(v.gas)} ppm</b></div>
        </div>
      </section>

      <section className="dayband">
        <h2>{t.dayH}</h2>
        <div className="dayscene reveal"><Video {...VID.day} t={t} label="Farmers working in the field"><FieldScene /></Video></div>
      </section>

      <section className="band" id="night">
        <div className="band-in">
          <div><h2>{t.nightH}</h2><p>{t.nightP}</p></div>
          <div className="panel night-panel">
            <div className="clock">{clock(h)}</div>
            <input type="range" min="0" max="12" step="0.25" value={h} style={{ '--p': `${(h / 12) * 100}%` }} onChange={(e) => setH(+e.target.value)} aria-label={t.scrub} aria-valuetext={clock(h)} />
            <div className="chips quick" role="group" aria-label={t.scrub}>{[0, 3, 6, 9, 12].map((x) => <button key={x} type="button" className={h === x ? 'on' : ''} aria-pressed={h === x} onClick={() => setH(x)}>{clock(x)}</button>)}</div>
            <div className="readout">
              <div><span>{t.temp}</span><b>{v.temp.toFixed(1)}°C</b></div><div><span>{t.hum}</span><b>{Math.round(v.hum)}%</b></div>
              <div className={risk ? 'hot' : ''}><span>{t.gas}</span><b>{Math.round(v.gas)}</b></div><div><span>{t.curtain}</span><b>{risk ? 60 : 40}%</b></div>
            </div>
            <div className={'verdict' + (risk ? ' hot' : '')}>{risk ? t.warn : t.ok}</div>
            <small>{t.sample}</small>
          </div>
        </div>
      </section>

      <section className="feats">
        <h2>{t.whatH}</h2>
        <div className="tiles">
          {t.wf.map(([title, d], i) => (
            <div key={i} className="tile6 reveal" style={{ '--d': `${i * .08}s` }}>
              <span className="ico-wrap"><svg viewBox="0 0 24 24" className="ico"><path d={ICONS[i]} /></svg></span>
              <h3>{title}</h3><p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="feats photos">
        <h2>{t.featH}</h2>
        <div className="grid">
          {feats.map(([r, d, slot, id]) => (
            <button key={r} className="feat reveal" onClick={() => go(r)}>
              <Photo slot={slot} src={PX(id, 900)} className="feat-img" />
              <h3>{t[r]}</h3><p>{t[d]}</p><span className="more" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cta">
        <Video {...VID.cta} t={t} className="cover" label="Farmer at work in golden fields at dusk"><Photo slot="band" src={PX(38121427, 1600)} className="cover" /></Video>
        <div className="cta-in"><h2>{t.h1}</h2><div className="actions"><button className="btn solid" onClick={() => go('signup')}>{t.signup}</button><button className="btn ghost light" onClick={() => go('storage')}>{t.open}</button></div></div>
      </section>
    </>
  )
}
