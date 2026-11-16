import { useEffect, useState } from 'react'
import {
  TEAM, FINISH_TEXT, ageLeague, openResign,
} from '../../lib/franchise2'
import { sfx } from '../../lib/juice'
import { Chyron, BigRec, BigNum, Stamp, Go, Flip, KLogo, fkVars, reduced, ActionBar } from './kit'
import { Man, CapBar, PlayerPage } from './dparts'
import { Resign, FreeAgency } from './Deals'
import { DraftDay } from './Draft'
import { Carousel } from './Staff'
import './fd.css'

// THE OFFSEASON: five stops, one screen each. COACHES (the carousel, the NFL's Black Monday: Staff.jsx) → AWARDS →
// RE-SIGN → FREE AGENCY → THE DRAFT, then a new season.
// (the steps as the player reads them: the one he's on lit, the ones behind him ticked; the next step's button is
// always at the bottom of the screen, ActionBar; the cap and the scouting room beside the step on a wide screen)
const STOPS = [['coaches', 'Coaches'], ['awards', 'Awards'], ['resign', 'Re-sign'], ['fa', 'Free agency'], ['draft', 'Draft']]

export default function Offseason({ F, act, owner, onBuild, foot }) {
  const i = STOPS.findIndex(([k]) => k === F.stage)
  // (free agency has its own cap line, live with the offers out, and the whole width for the market)
  const cap = F.stage === 'resign'
  const side = F.stage !== 'fa' && (cap || foot)
  return (
    <div className="fd fk fd-off">
      <nav className="fd-stops" aria-label="Offseason steps">
        <span className="fd-stops-h"><b>Offseason</b><small>Step {i + 1} of {STOPS.length}: {STOPS[i]?.[1]}</small></span>
        <ol>
          {STOPS.map(([k, n], j) => <li key={k} className={j === i ? 'is-on' : j < i ? 'is-done' : ''} aria-current={j === i ? 'step' : undefined}><i>{j < i ? '✓' : j + 1}</i><span>{n}</span></li>)}
        </ol>
      </nav>
      <div className={`fd-off-grid${side ? ' has-side' : ''}${F.stage === 'fa' ? ' is-fa' : ''}`}>
        <div className="fd-off-main">
          {F.stage === 'coaches' && <Carousel F={F} act={act} owner={owner} />}
          {F.stage === 'awards' && <Awards F={F} act={act} owner={owner} />}
          {F.stage === 'resign' && <Resign F={F} act={act} owner={owner} />}
          {F.stage === 'fa' && <FreeAgency F={F} act={act} owner={owner} />}
          {F.stage === 'draft' && <DraftDay F={F} act={act} owner={owner} onBuild={onBuild} />}
          {F.stage === 'fa' && foot}
        </div>
        {side && <aside className="fd-off-side">{cap && <CapBar F={F} />}{foot}</aside>}
      </div>
    </div>
  )
}

// ── 1. AWARDS ────────────────────────────────────────────────────────────────
// the season in one card, then the league's awards turned over one at a time, then the All-Pros
const AW = [['mvp', 'MOST VALUABLE PLAYER'], ['opoy', 'OFFENSIVE PLAYER OF THE YEAR'], ['dpoy', 'DEFENSIVE PLAYER OF THE YEAR'], ['oroy', 'OFFENSIVE ROOKIE OF THE YEAR'], ['droy', 'DEFENSIVE ROOKIE OF THE YEAR']]
const SPOT_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ot: 'OT', og: 'OG', c: 'C', edge: 'EDGE', dt: 'DT', lb: 'LB', cb: 'CB', s: 'S' }
function findMan(F, w) { const p = w && F.teams[w.t]?.r.find(x => x.i === w.i); return p ?? (w ? { i: w.i, n: w.n, p: w.p, o: 0, b: w.b } : null) }
function Awards({ F, act, owner }) {
  const h = F.hist[F.hist.length - 1], aw = F.aw
  const list = AW.filter(([k]) => aw?.[k])
  const [n, setN] = useState(() => (reduced() ? list.length : 0))
  const [page, setPage] = useState(null)
  const [all, setAll] = useState(false)
  useEffect(() => { if (n >= list.length) return; const t = setTimeout(() => setN(x => x + 1), n === 0 ? 500 : 650); return () => clearTimeout(t) }, [n, list.length])
  const champ = h.fin === 'champ'
  const ours = (aw?.ap ?? []).filter(x => x.t === F.team)
  const pb = Object.entries(aw?.hon ?? {}).filter(([id, v]) => v === 'PB' && F.teams[F.team].r.some(p => String(p.i) === id)).length
  return (
    <>
      <section className="fd-recap" style={fkVars(F.team)}>
        <Chyron team={F.team} tone={champ ? 'gold' : 'team'} title={champ ? 'SUPER BOWL CHAMPIONS' : `${h.y} SEASON`} tag={h.y} sub={champ ? null : FINISH_TEXT[h.fin] ?? ''} />
        <div className="fd-recap-row">
          <BigRec w={h.w} l={h.l} t={h.t} size={72} />
          <span className="fd-recap-facts">
            <BigNum v={h.pf} label="POINTS" size={30} /><BigNum v={h.pa} label="ALLOWED" size={30} />
            {ours.length > 0 && <BigNum v={ours.length} label="ALL-PROS" size={30} />}
            {pb > 0 && <BigNum v={pb} label="PRO BOWLS" size={30} />}
          </span>
        </div>
      </section>
      <div className="fd-awards" onClick={() => setN(list.length)}>
        {list.map(([k, title], j) => {
          const w = aw[k], p = findMan(F, w)
          return (
            <Flip key={k} open={j < n} className="fd-award"
              back={<div className="fd-award-back"><small>{F.year}</small><b>{title}</b></div>}
              front={<div className="fd-award-face"><small>{title}</small><Man F={F} p={p} s={w.t} owner={owner} size={k === 'mvp' ? 'l' : 'm'} line={TEAM[w.t].nick.toUpperCase()} onClick={p?.o ? () => setPage(p.i) : undefined} /><span className="fd-award-line" style={fkVars(w.t)}>{w.line}</span>{w.t === F.team && j < n && <Stamp kind="gold" delay={200}>{k.toUpperCase()}</Stamp>}</div>} />
          )
        })}
      </div>
      {aw?.coy && n >= list.length && (
        <div className="fd-coy" style={fkVars(aw.coy.t)}>
          <KLogo s={aw.coy.t} size={40} />
          <span><small>COACH OF THE YEAR</small><b>{aw.coy.n}</b><em>{aw.coy.was} WINS TO {aw.coy.w}</em></span>
        </div>
      )}
      {n >= list.length && (
        <>
          <Chyron tone="ink" size="s" title="ALL-PRO FIRST TEAM" right={<button className="fd-link" onClick={() => { setAll(x => !x); sfx('tap') }}>{all ? TEAM[F.team].nick.toUpperCase() : `ALL ${aw.ap.length}`}</button>} />
          {(all ? aw.ap : ours).map((x, j) => (
            <div key={`${x.spot}-${x.i}`} className={`fd-ap${x.t === F.team ? ' is-me' : ''}`} style={{ ...fkVars(x.t), '--d': `${j * 25}ms` }}>
              <i>{SPOT_LABEL[x.spot]}</i><KLogo s={x.t} size={22} /><b>{x.n}</b><small>{x.line}</small>
            </div>
          ))}
          {!all && !ours.length && <div className="fd-none">NONE FROM THE {TEAM[F.team].nick.toUpperCase()}</div>}
        </>
      )}
      <ActionBar><Go onClick={() => { act(X => { ageLeague(X); openResign(X) }); sfx('whistle') }}>Next: Re-sign players</Go></ActionBar>
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}

// ── 2. RE-SIGN and 3. FREE AGENCY: Deals.jsx ───────────────────────────────────
