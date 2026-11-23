import { useContext, useState } from 'react'
import { TEAM, seasonText, FINISH_TEXT, AWARD_FULL, nick, manOf } from '../../../lib/franchise2/nba'
import { sfx } from '../../../lib/juice'
import { Banner, Chyron, BigNum, Fact, Fold, KLogo, fkVars } from '../kit'
import { AwardTeams, statLine, cfMvps, ManOpen, ManSheetHost, tapMan } from './NbaOffseason'
import './nbaoff.css'

// HISTORY: every season on the wall (record, how it ended), the league's award winners by year, the save itself.
// A tap on a winner opens his page, read-only (ManSheetHost without act).
const AW_KEYS = ['MVP', 'FMVP', 'DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH']
const AW_LABEL = { ...AWARD_FULL, ECF: 'Eastern Conference Finals MVP', WCF: 'Western Conference Finals MVP' }
export default function NbaHistory({ F, owner, onSlots, onDelete }) {
  return <ManSheetHost F={F} owner={owner}><History F={F} onSlots={onSlots} onDelete={onDelete} /></ManSheetHost>
}
function History({ F, onSlots, onDelete }) {
  const [sure, setSure] = useState(false)
  const H = F.hist ?? []
  const best = H.slice().sort((a, b) => b.w - a.w)[0]
  return (
    <div className="nb-hist">
      <div className="fsu-card-nums nb-hist-nums">
        <BigNum v={F.rings ?? 0} label={F.rings === 1 ? 'TITLE' : 'TITLES'} size={52} tone={F.rings ? 'gold' : undefined} />
        <Fact v={H.length} label={H.length === 1 ? 'SEASON' : 'SEASONS'} size={36} />
        <Fact v={best ? `${best.w}-${best.l}` : '-'} label="BEST RECORD" size={36} />
      </div>
      <Chyron team={F.team} title="The wall" sub={`${F.owner.toUpperCase()} · GENERAL MANAGER`} />
      {!H.length && <p className="fh-next-note">The first season goes up here when it ends.</p>}
      <div className="nb-wall-banners">
        {H.slice().reverse().map((h, k) => <Banner key={h.y} year={seasonText(h.y)} title={(h.finish === 'champ' ? 'NBA CHAMPIONS' : FINISH_TEXT[h.finish] ?? '').toUpperCase()} rec={`${h.w}-${h.l}${h.seed ? ` · NO. ${h.seed} SEED` : ''}`} team={h.s} gold={h.finish === 'champ'} delay={k * 50} />)}
      </div>
      {H.length > 0 && <Chyron tone="ink" size="s" title="League honors" sub="EVERY SEASON'S AWARDS" />}
      {H.slice().reverse().map((h, k) => <Honors key={h.y} F={F} h={h} open={k === 0} />)}
      <div className="nb-save">
        <button type="button" className="fh-textbtn" onClick={() => { sfx('tap'); onSlots() }}>Save slots</button>
        {!sure ? <button type="button" className="fh-textbtn" onClick={() => setSure(true)}>Delete this save</button>
          : <span className="nb-sure">Delete the {TEAM[F.team].nick} save for good? <button type="button" className="fh-textbtn" onClick={() => setSure(false)}>Keep</button><button type="button" className="fh-textbtn is-danger" onClick={onDelete}>Delete</button></span>}
      </div>
    </div>
  )
}
// one season's honors: the trophies (each winner's team and line), then the All-NBA, All-Defensive and All-Rookie teams
function Honors({ F, h, open }) {
  const page = useContext(ManOpen)
  const A = h.aw ?? {}
  const list = [...AW_KEYS.filter(k => A[k]).map(k => [k, A[k]]), ...cfMvps(F, h)]
  return (
    <Fold className="nbo-hon" open={open} title={seasonText(h.y)} right={h.champ ? `${nick(h.champ)} champions` : null}>
      <ul className="nbo-hon-list">
        {list.map(([k, w]) => {
          const line = statLine(F, w.i, h.y, k)
          const p = manOf(F, w.i)
          return (
            <li key={k} className={w.s === F.team ? 'is-me' : ''} style={w.s && TEAM[w.s] ? fkVars(w.s) : undefined} {...tapMan(page, F, w.i)}>
              {w.s && TEAM[w.s] ? <KLogo s={w.s} size={24} /> : <i className="nbo-nologo" />}
              <span><small>{AW_LABEL[k] ?? k}</small><b>{w.n}</b><em>{[p?.p, TEAM[w.s]?.short, line].filter(Boolean).join(' · ')}</em></span>
            </li>
          )
        })}
      </ul>
      <AwardTeams F={F} y={h.y} title="All-NBA" teams={A.ALL} names={['First team', 'Second team', 'Third team']} />
      <AwardTeams F={F} y={h.y} title="All-Defensive" teams={A.ALLDEF} names={['First team', 'Second team']} k="DEF" />
      <AwardTeams F={F} y={h.y} title="All-Rookie" teams={A.ROOKIE} names={['First team', 'Second team']} />
    </Fold>
  )
}
