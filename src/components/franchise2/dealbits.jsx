import { TEAM, scoutRead, lastLineOf, statLine, BONUS, bonusOf, MAX_YEARS, NO_CAP_ROOM } from '../../lib/franchise2'
import { KLogo } from './kit'
import { sfx } from '../../lib/juice'
import './deals.css'

// The small parts the deal screens share (re-sign talks, free agency, a man's page): what the scouts say about a
// man, his last season, and the offer builder (years, money a year, signing bonus).
export const money = v => (v >= 10 ? `$${Math.round(v * 10) % 10 ? (Math.round(v * 10) / 10).toFixed(1) : Math.round(v)}M` : `$${(Math.round(v * 10) / 10).toFixed(1)}M`)
const yrs = y => `${y} ${y === 1 ? 'YR' : 'YRS'}`

// what the scouts say: his ceiling and where he is on the road (never a number). own: our man (a closer read)
export function ScoutNote({ p, own = false, className = '' }) {
  const r = scoutRead(p, own)
  if (!r) return null
  return (
    <span className={`dl-scout ${className}`}>
      <small>SCOUTS</small>
      <b>{r.line}</b>
      {r.stage !== 'PAST HIS PEAK' && <em>{r.stage}</em>}
    </span>
  )
}
// his last season: the team, the line (a made-up veteran the market found: who let him go)
export function LastLine({ F, p, className = '' }) {
  const L = lastLineOf(p)
  if (!L) return null
  const nick = TEAM[L.team]?.nick?.toUpperCase() ?? ''
  if (!L.gp) return <span className={`dl-last ${className}`}><KLogo s={L.team} size={18} /><span>RELEASED BY THE {nick}</span></span>
  const year = F.phase === 'off' ? F.year : F.year - 1
  return (
    <span className={`dl-last ${className}`}>
      <KLogo s={L.team} size={18} />
      <span><i>{year} · {L.gp} G</i> {statLine(p, L.t)}</span>
    </span>
  )
}

// A − value + stepper (sub: a line under the value; LIGHT's compact rows, light.css .lt-terms)
export function Step({ label, text, sub = null, onDown, onUp, downOk = true, upOk = true, className = '' }) {
  return (
    <div className={`dl-step ${className}`}>
      <span className="dl-step-l">{label}</span>
      <button type="button" aria-label={`Less: ${label}`} disabled={!downOk} onClick={() => { onDown(); sfx('tap') }}>−</button>
      {sub != null ? <span className="dl-step-v"><b>{text}</b><small>{sub}</small></span> : <b>{text}</b>}
      <button type="button" aria-label={`More: ${label}`} disabled={!upOk} onClick={() => { onUp(); sfx('tap') }}>+</button>
    </div>
  )
}
// The offer: years, money a year (a slider and fine steps), the signing bonus. o: { $, y, b }; lo / hi: the money's range
export function Terms({ o, set, lo, hi }) {
  const step = o.$ >= 20 ? 0.5 : o.$ >= 5 ? 0.25 : 0.1
  const r = v => Math.round(Math.max(lo, Math.min(hi, v)) * 100) / 100
  return (
    <div className="dl-terms">
      <Step label="YEARS" text={o.y === 1 ? '1 YEAR' : `${o.y} YEARS`} onDown={() => set({ ...o, y: o.y - 1 })} onUp={() => set({ ...o, y: o.y + 1 })} downOk={o.y > 1} upOk={o.y < MAX_YEARS} />
      <Step label="A YEAR" text={money(o.$)} onDown={() => set({ ...o, $: r(o.$ - step) })} onUp={() => set({ ...o, $: r(o.$ + step) })} downOk={o.$ > lo + 1e-9} upOk={o.$ < hi - 1e-9} />
      <input className="dl-range" type="range" min={lo} max={hi} step={0.1} value={o.$} aria-label="Money a year" onChange={e => set({ ...o, $: r(+e.target.value) })} />
      <div className="dl-bonus">
        <span className="dl-step-l">SIGNING BONUS</span>
        <div className="dl-seg" role="radiogroup" aria-label="Signing bonus">
          {BONUS.map(([k], j) => <button key={k} type="button" role="radio" aria-checked={o.b === j} className={o.b === j ? 'is-on' : ''} onClick={() => { set({ ...o, b: j }); sfx('tap') }}>{k}</button>)}
        </div>
      </div>
      <p className="dl-sum"><span>TOTAL <b>{money(o.$ * o.y)}</b></span><span>BONUS <b>{money(bonusOf(o))}</b></span><span>{o.b ? 'MORE GUARANTEED · MORE DEAD MONEY IF CUT' : 'THE USUAL SHARE'}</span></p>
    </div>
  )
}
// the cap, live: the room now, what's out in offers, and what's left after this one
export function CapLine({ room, out = 0, take = 0 }) {
  // (the league rule NO SALARY CAP: rules.js)
  if (room >= NO_CAP_ROOM) return <div className="dl-cap"><span><small>SALARY CAP</small><b>OFF</b></span>{out > 0 && <span><small>OFFERS OUT</small><b>{money(out)}</b></span>}</div>
  const left = Math.round((room - out - take) * 10) / 10
  return (
    <div className={`dl-cap${left < 0 ? ' is-over' : ''}`}>
      <span><small>CAP ROOM</small><b>{room < 0 ? `-${money(-room)}` : money(room)}</b></span>
      {out > 0 && <span><small>OFFERS OUT</small><b>{money(out)}</b></span>}
      <span><small>{take ? 'AFTER THIS DEAL' : 'LEFT'}</small><b>{left < 0 ? `-${money(-left)}` : money(left)}</b></span>
    </div>
  )
}
export { yrs }
