import { useMemo, useState } from 'react'
import { TEAM, POS_LABEL, DIVISIONS, CONF_OF, leagueStats } from '../../lib/franchise2'
import { ovrOf } from '../../lib/squadSeason'
import { buildFaceUrl } from '../../lib/franchise2/faces'
import { sfx } from '../../lib/juice'
import { Chyron, BigNum, Banner, KLogo, LowerThird, Go, fkVars } from './kit'
import { PlayerPage } from './dparts'
import './fd.css'

// HISTORY: the team's hall. The banners in the rafters (division titles, conference titles, Super Bowls), the
// rings, every season, the numbers hung up for the player's builds, the franchise's records, his builds' careers,
// and the league's champions while he's run the team.
const FIN_SHORT = { champ: 'WON SUPER BOWL', sb: 'LOST SUPER BOWL', conf: 'LOST CONF. TITLE', div: 'LOST DIVISIONAL', wc: 'LOST WILD CARD', out: 'MISSED PLAYOFFS' }
const n = v => Math.round(v ?? 0).toLocaleString('en-US')
const RECORDS = [['py', 'PASSING YARDS'], ['ptd', 'TOUCHDOWN PASSES'], ['ry', 'RUSHING YARDS'], ['ryd', 'RECEIVING YARDS'], ['rc', 'CATCHES'], ['sck', 'SACKS'], ['dint', 'INTERCEPTIONS'], ['tk', 'TACKLES']]

export default function HistoryTab({ F, owner, act, onSlots, onDelete }) {
  const [sure, setSure] = useState(false)
  const [page, setPage] = useState(null)
  const H = F.hist ?? []
  const T = TEAM[F.team]
  const divName = DIVISIONS.find(d => d.teams.includes(F.team))?.name ?? ''
  const w = H.reduce((a, h) => a + h.w, 0), l = H.reduce((a, h) => a + h.l, 0), t = H.reduce((a, h) => a + h.t, 0)
  const trips = H.filter(h => h.seed).length, divs = H.filter(h => h.div).length
  // the banners: what a team hangs (a division title, a conference title, a Super Bowl)
  const banners = H.flatMap(h => {
    const out = []
    if (h.fin === 'champ') out.push({ y: h.y, title: 'SUPER BOWL CHAMPIONS', gold: true })
    if (h.fin === 'champ' || h.fin === 'sb') out.push({ y: h.y, title: `${CONF_OF[F.team]} CHAMPIONS` })
    if (h.div) out.push({ y: h.y, title: `${divName.toUpperCase()} CHAMPIONS` })
    return out.map(b => ({ ...b, rec: `${h.w}-${h.l}${h.t ? `-${h.t}` : ''}` }))
  })
  const records = useFranchiseRecords(F)
  return (
    <div className="fd fk">
      <section className="fd-hall" style={fkVars(F.team)}>
        <img className="fd-hall-logo" src={T.logo} alt="" draggable={false} />
        <span className="fd-hall-txt"><small>{T.name.toUpperCase()}</small><b>THE HALL</b><em>SINCE {H[0]?.y ?? F.year} · GM {String(owner || 'GUEST').toUpperCase()}</em></span>
      </section>
      <div className="fd-hall-facts">
        <BigNum v={F.rings ?? 0} label={F.rings === 1 ? 'RING' : 'RINGS'} size={52} tone={F.rings ? 'gold' : undefined} />
        <BigNum v={H.length} label="SEASONS" size={52} />
        <span className="fk-big" style={{ '--s': '52px' }}><b>{w}-{l}{t ? `-${t}` : ''}</b><small>ALL-TIME</small></span>
        <BigNum v={trips} label="PLAYOFF TRIPS" size={34} />
        <BigNum v={divs} label="DIVISION TITLES" size={34} />
      </div>

      <Chyron team={F.team} title="THE RAFTERS" right={banners.length || null} />
      {banners.length ? (
        <div className="fd-rafters">
          {banners.map((b, i) => <Banner key={`${b.y}-${b.title}`} year={b.y} title={b.title} rec={b.rec} team={F.team} gold={b.gold} delay={i * 90} />)}
        </div>
      ) : <div className="fd-none">NO BANNERS YET</div>}

      {(F.rings ?? 0) > 0 && (
        <div className="fd-rings">
          {H.filter(h => h.fin === 'champ').map(h => <span key={h.y} className="fd-ring"><i aria-hidden="true" /><b>{h.y}</b></span>)}
        </div>
      )}

      {H.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="SEASON BY SEASON" />
          <div className="fd-years">
            {[...H].reverse().map(h => (
              <span key={h.y} className={`fd-year is-${h.fin}${h.div ? ' is-div' : ''}`} style={fkVars(F.team)}>
                <small>{h.y}</small><b>{h.w}-{h.l}{h.t ? `-${h.t}` : ''}</b><em>{h.fin === 'champ' ? 'CHAMPIONS' : FIN_SHORT[h.fin]}</em>
                {h.stars?.length ? <i>{h.stars.map(s => s.aw).join(' · ')}</i> : null}
              </span>
            ))}
          </div>
        </>
      )}

      {F.retired?.length > 0 && (
        <>
          <Chyron team={F.team} size="s" title="RETIRED NUMBERS" />
          <div className="fd-jerseys">
            {F.retired.map(r => <span key={`${r.b}-${r.num}`} className="fd-jersey" style={fkVars(F.team)}><b>{r.num}</b><small>{String(r.n).split(' ').slice(-1)[0].toUpperCase()}</small><em>{r.seasons} SEASONS</em></span>)}
          </div>
        </>
      )}

      {records.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="FRANCHISE RECORDS" right="ONE SEASON" />
          <div className="fd-plaques">
            {records.map(r => (
              <span key={r.label} className="fd-plaque">
                <small>{r.label}</small><b>{r.v}</b><em>{r.who} · {r.y}</em>
              </span>
            ))}
          </div>
        </>
      )}

      <Chyron team={F.team} size="s" title={`${String(owner || 'GUEST').toUpperCase()}'S BUILDS`} />
      {F.builds.filter(B => !B.prospect || B.pid != null).map((B, i) => <BuildCareer key={i} F={F} B={B} owner={owner} onOpen={setPage} />)}

      {F.lh?.length > 0 && (
        <>
          <Chyron tone="gold" size="s" title="SUPER BOWL WINNERS" />
          {[...F.lh].reverse().map(h => (
            <div key={h.y} className={`fd-champ-row${h.champ === F.team ? ' is-me' : ''}`} style={fkVars(h.champ)}>
              <small>{h.y}</small><KLogo s={h.champ} size={30} /><b>{TEAM[h.champ].nick.toUpperCase()}</b>
              <span>{h.score} {h.runner}</span>
              {h.aw?.MVP && <em>MVP {h.aw.MVP[0]}</em>}
            </div>
          ))}
        </>
      )}

      <div className="fd-manage">
        <Go ghost onClick={() => { sfx('tap'); onSlots() }}>SAVE SLOTS</Go>
        {sure ? <Go ghost className="is-danger" onClick={onDelete}>DELETE FOR GOOD</Go> : <Go ghost onClick={() => { setSure(true); sfx('deny') }}>DELETE FRANCHISE</Go>}
      </div>
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}

// A build's career: his card, his seasons, his awards, his totals
const MAIN = { qb: ['py', 'ptd'], rb: ['ry', 'rtd'], wr: ['ryd', 'rctd'], te: ['ryd', 'rctd'], ol: ['sn', 'sa'], dl: ['sck', 'tfl'], lb: ['tk', 'sck'], db: ['dint', 'pbu'] }
const LBL = { py: 'YDS', ptd: 'TD', ry: 'YDS', rtd: 'TD', ryd: 'YDS', rctd: 'TD', sn: 'SNAPS', sa: 'SACKS ALLOWED', sck: 'SACKS', tfl: 'TFL', tk: 'TKL', dint: 'INT', pbu: 'PD' }
function BuildCareer({ F, B, owner, onOpen }) {
  const idx = F.builds.indexOf(B)
  const p = B.done ? null : F.teams[F.team].r.find(x => x.b === idx)
  const tot = {}
  for (const c of B.car) for (const [k, v] of Object.entries(c.st ?? {})) tot[k] = (tot[k] ?? 0) + v
  if (p && F.phase !== 'off') { const st = leagueStats(F)[String(p.i)] ?? {}; for (const k of MAIN[B.pos] ?? []) tot[k] = (tot[k] ?? 0) + (st[k] ?? 0) }
  const counts = Object.entries(B.car.filter(c => c.aw).reduce((a, c) => ({ ...a, [c.aw]: (a[c.aw] ?? 0) + 1 }), {}))
  const pros = B.car.filter(c => c.hon === 'AP').length, bowls = B.car.filter(c => c.hon === 'AP' || c.hon === 'PB').length
  const rings = B.car.filter(c => c.ring).length
  const line = (MAIN[B.pos] ?? []).map(k => `${n(tot[k])} ${LBL[k]}`).join(' · ')
  return (
    <div className="fd-build">
      <LowerThird name={B.name ?? POS_LABEL[B.pos]} pos={POS_LABEL[B.pos]} num={B.num} ovr={ovrOf(B.pos, B.build)} photo={buildFaceUrl(B, TEAM[F.team]?.color)} team={F.team} mine={owner || 'GM'} line={`${B.car.length} ${B.car.length === 1 ? 'SEASON' : 'SEASONS'}${B.done ? ' · RETIRED' : B.left ? ' · GONE' : ''}`} onClick={p ? () => onOpen(p.i) : undefined} />
      <div className="fd-build-row">
        <span className="fd-build-tot">{line}</span>
        <span className="fd-build-hon">
          {rings > 0 && <b className="is-gold">{rings > 1 ? `${rings}x ` : ''}CHAMPION</b>}
          {counts.map(([k, c]) => <b key={k} className="is-gold">{c > 1 ? `${c}x ` : ''}{k}</b>)}
          {pros > 0 && <b>{pros > 1 ? `${pros}x ` : ''}ALL-PRO</b>}
          {bowls > 0 && <b>{bowls > 1 ? `${bowls}x ` : ''}PRO BOWL</b>}
        </span>
      </div>
    </div>
  )
}

// The franchise's one-season records: the team's (most wins, points), and every man's season for this team
// (his career lines, a build's own)
function useFranchiseRecords(F) {
  return useMemo(() => {
    const H = F.hist ?? [], out = []
    if (!H.length) return out
    const best = (k, lower) => [...H].sort((a, b) => (lower ? a[k] - b[k] : b[k] - a[k]))[0]
    const bw = best('w'), bp = best('pf'), ba = best('pa', true)
    out.push({ label: 'WINS', v: bw.w, who: `${bw.w}-${bw.l}${bw.t ? `-${bw.t}` : ''}`, y: bw.y })
    out.push({ label: 'POINTS', v: bp.pf, who: `${(bp.pf / 17).toFixed(1)} A GAME`, y: bp.y })
    out.push({ label: 'FEWEST ALLOWED', v: ba.pa, who: `${(ba.pa / 17).toFixed(1)} A GAME`, y: ba.y })
    // a man's best season here (awards.js keeps them in F.frec as the seasons end)
    for (const [k, label] of RECORDS) { const r = F.frec?.[k]; if (r) out.push({ label, v: n(r[0]), who: r[1], y: r[2] }) }
    return out
  }, [F, F.hist?.length]) // eslint-disable-line react-hooks/exhaustive-deps
}
