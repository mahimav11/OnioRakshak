const STARS = [[40,50,1.6,0],[110,120,1.2,.8],[190,40,1.8,1.5],[250,100,1.2,.3],[320,35,1.6,1.1],[430,150,1.3,.6],[60,200,1.1,1.9],[460,60,1.5,.2],[150,180,1.2,1.2],[300,160,1.1,.9],[400,230,1.2,1.7],[220,210,1,.5]]

// Night: the farmer sleeps, the guardian shield watches the chaal.
export function NightScene() {
  return (
    <svg className="scene" viewBox="0 0 480 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#170a22" /><stop offset=".6" stopColor="#4a2160" /><stop offset="1" stopColor="#b5507a" /></linearGradient>
        <radialGradient id="halo"><stop offset="0" stopColor="#7ED3D9" stopOpacity=".5" /><stop offset="1" stopColor="#7ED3D9" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="480" height="600" fill="url(#sky)" />
      {STARS.map(([x, y, r, d], i) => <circle key={i} cx={x} cy={y} r={r} fill="#F6EFE3" className="star" style={{ animationDelay: `${d}s` }} />)}
      <circle cx="390" cy="86" r="30" fill="#F6EFE3" /><circle cx="403" cy="78" r="27" fill="#3d1c52" />
      <path d="M0 400 Q120 340 260 395 T480 370 V600 H0Z" fill="#2c1440" />
      <path d="M0 450 Q160 405 300 445 T480 430 V600 H0Z" fill="#3B1D4A" />
      {/* house + sleeping farmer */}
      <rect x="40" y="372" width="130" height="96" fill="#4f2b5e" /><polygon points="28,374 105,320 182,374" fill="#C8456B" />
      <rect x="76" y="398" width="58" height="42" rx="3" fill="#F0B45A" className="glow" />
      <circle cx="94" cy="424" r="7" fill="#B0714A" /><rect x="86" y="428" width="44" height="12" rx="5" fill="#C8456B" /><rect x="76" y="418" width="58" height="3" fill="#6b3a20" opacity=".5" />
      {['z', 'z', 'Z'].map((z, i) => <text key={i} x={140 + i * 14} y={392 - i * 4} className="z" style={{ animationDelay: `${i * 1.1}s`, fontSize: 14 + i * 4 }} fill="#F6EFE3">{z}</text>)}
      {/* chaal */}
      <rect x="290" y="440" width="8" height="34" fill="#5a3a2a" /><rect x="410" y="440" width="8" height="34" fill="#5a3a2a" />
      <rect x="280" y="392" width="148" height="52" fill="#9a6a44" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <line key={i} x1={288 + i * 12} x2={288 + i * 12} y1="396" y2="440" stroke="#5a3a2a" strokeWidth="3" />)}
      <polygon points="270,394 354,356 438,394" fill="#5a3a2a" />
      {/* guardian */}
      <polygon points="354,330 288,392 420,392" fill="#7ED3D9" className="beam" />
      <g className="guard"><circle cx="354" cy="270" r="70" fill="url(#halo)" />
        {[0, 1, 2].map((i) => <circle key={i} cx="354" cy="270" r="40" className="scan" style={{ animationDelay: `${i * 1.2}s` }} />)}
        <image href="/logo-mark.png" x="314" y="222" width="80" height="92" /></g>
      {/* field */}
      <rect y="500" width="480" height="100" fill="#24102f" />
      {Array.from({ length: 14 }, (_, i) => { const x = 18 + i * 35, y = 548 + (i % 2) * 26; return <path key={i} className="sway" style={{ animationDelay: `${i * .25}s` }} d={`M${x} ${y} q3 -20 0 -38 M${x} ${y} q-9 -14 -14 -28 M${x} ${y} q9 -14 14 -28`} stroke="#6DCB8A" strokeWidth="3" fill="none" strokeLinecap="round" /> })}
      {[[80, 470], [200, 510], [330, 480], [430, 520], [150, 440], [250, 460]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#F0D56A" className="fly" style={{ animationDelay: `${i * .7}s` }} />)}
    </svg>
  )
}

function Farmer({ kind, color }) {
  const skin = '#A9683F'
  return (
    <g className="farmer">
      <rect className="leg" x="-9" y="-36" width="8" height="36" rx="3" fill="#F2E6D0" />
      <rect className="leg l2" x="1" y="-36" width="8" height="36" rx="3" fill="#F2E6D0" />
      {kind === 'sack' && <ellipse cx="-14" cy="-62" rx="15" ry="19" fill="#C9A66B" />}
      <rect x="-14" y="-76" width="28" height="46" rx="12" fill={color} />
      <circle cy="-86" r="10" fill={skin} />
      {kind === 'basket' ? <>
        <path d="M-11 -90 q11 -14 22 0z" fill="#C8456B" />
        <ellipse cy="-103" rx="17" ry="6" fill="#8a5a3a" />{[-9, -2, 6].map((x) => <circle key={x} cx={x} cy="-108" r="6" fill="#C8456B" />)}
      </> : <path d="M-13 -89 q13 -17 26 0 q-13 7 -26 0z" fill="#E39A2D" />}
      {kind === 'hoe' && <g className="arm"><line x1="8" y1="-70" x2="30" y2="-30" stroke="#5a3a2a" strokeWidth="4" strokeLinecap="round" /><path d="M26 -34 l14 8 -6 6z" fill="#7a7f86" /></g>}
      <rect className="arm" x="-3" y="-72" width="6" height="28" rx="3" fill={skin} />
    </g>
  )
}

// Day: farmers walk the rows of onion plants.
export function FieldScene() {
  const walkers = [['sack', '#3B7F5B', 220, 258, 1.1], ['basket', '#C0577A', 640, 280, 1.25], ['hoe', '#58306B', 960, 246, .95]]
  return (
    <svg className="scene day" viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7C98B" /><stop offset="1" stopColor="#F6EFE3" /></linearGradient></defs>
      <rect width="1200" height="320" fill="url(#dsky)" />
      <g transform="translate(990 84)"><g className="rays">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-52" x2="0" y2="-74" stroke="#E39A2D" strokeWidth="5" strokeLinecap="round" transform={`rotate(${i * 30})`} />)}</g><circle r="40" fill="#F0AA45" /></g>
      <path d="M0 200 Q250 120 520 190 T1200 170 V320 H0Z" fill="#B8CF8A" /><path d="M0 235 Q300 190 620 230 T1200 215 V320 H0Z" fill="#86B56C" />
      <rect y="250" width="1200" height="70" fill="#4F8F4E" />
      {Array.from({ length: 3 }, (_, r) => Array.from({ length: 34 }, (_, i) => { const x = 14 + i * 36 + r * 12, y = 262 + r * 22; return <path key={r + '-' + i} className="sway" style={{ animationDelay: `${(i + r) * .2}s` }} d={`M${x} ${y} q3 -16 0 -30 M${x} ${y} q-8 -11 -11 -23 M${x} ${y} q8 -11 11 -23`} stroke="#2F6B3C" strokeWidth="3" fill="none" strokeLinecap="round" /> }))}
      {walkers.map(([k, c, x, y, s]) => <g key={k} transform={`translate(${x} ${y}) scale(${s})`}><Farmer kind={k} color={c} /></g>)}
    </svg>
  )
}
