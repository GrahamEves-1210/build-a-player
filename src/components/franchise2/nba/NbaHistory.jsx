import { useState } from 'react'
import { TEAM, seasonText, FINISH_TEXT, AWARD_FULL, nick } from '../../../lib/franchise2/nba'
import { sfx } from '../../../lib/juice'
import { Banner, Chyron, BigNum, Fact } from '../kit'

// HISTORY: every season on the wall (record, how it ended), the league's award winners by year, the save itself
export default function NbaHistory({ F, onSlots, onDelete }) {
  const [sure, setSure] = useState(false)
  const H = F.hist ?? []
  const best = H.slice().sort((a, b) => b.w - a.w)[0]
  return (
    <div className="nb-hist">
      <div className="fsu-card-nums nb-hist-nums">
        <BigNum v={F.rings ?? 0} label={F.rings === 1 ? 'TITLE' : 'TITLES'} size={52} tone={F.rings ? 'gold' : undefined} />
        <Fact v={H.length} label="SEASONS" size={36} />
        <Fact v={best ? `${best.w}-${best.l}` : '-'} label="BEST RECORD" size={36} />
      </div>
      <Chyron team={F.team} title="The wall" sub={`${F.owner.toUpperCase()} · GENERAL MANAGER`} />
      {!H.length && <p className="fh-next-note">The first season goes up here when it ends.</p>}
      <div className="nb-wall-banners">
        {H.slice().reverse().map((h, k) => <Banner key={h.y} year={seasonText(h.y)} title={(h.finish === 'champ' ? 'NBA CHAMPIONS' : FINISH_TEXT[h.finish] ?? '').toUpperCase()} rec={`${h.w}-${h.l}${h.seed ? ` · NO. ${h.seed} SEED` : ''}`} team={h.s} gold={h.finish === 'champ'} delay={k * 50} />)}
      </div>
      {H.length > 0 && <Chyron tone="ink" size="s" title="League honors" />}
      {H.slice().reverse().map(h => (
        <section key={h.y} className="nb-honors">
          <b>{seasonText(h.y)}{h.champ ? ` · ${nick(h.champ)} champions` : ''}</b>
          <ul>
            {['MVP', 'FMVP', 'DPOY', 'ROY', '6MOY', 'MIP'].filter(k => h.aw?.[k]).map(k => <li key={k}><small>{AWARD_FULL[k]}</small><span>{h.aw[k].n} · {TEAM[h.aw[k].s]?.short ?? ''}</span></li>)}
            {(h.aw?.ALL ?? []).map((t, k) => <li key={k}><small>All-NBA {['First', 'Second', 'Third'][k]} Team</small><span>{t.map(x => x.n).join(', ')}</span></li>)}
          </ul>
        </section>
      ))}
      <div className="nb-save">
        <button type="button" className="fh-textbtn" onClick={() => { sfx('tap'); onSlots() }}>Save slots</button>
        {!sure ? <button type="button" className="fh-textbtn" onClick={() => setSure(true)}>Delete this save</button>
          : <span className="nb-sure">Delete the {TEAM[F.team].nick} save for good? <button type="button" className="fh-textbtn" onClick={() => setSure(false)}>Keep</button><button type="button" className="fh-textbtn is-danger" onClick={onDelete}>Delete</button></span>}
      </div>
    </div>
  )
}
