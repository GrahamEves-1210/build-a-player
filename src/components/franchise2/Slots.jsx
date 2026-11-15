import { useMemo } from 'react'
import { slotSummary, SLOTS_N, TEAM } from '../../lib/franchise2'
import { FRANCHISE_ART } from '../../lib/franchiseLive'
import { sfx } from '../../lib/juice'
import { IconClose } from '../app/icons'
import { Chyron, KLogo, fkVars } from './kit'
import { NameForm } from './Setup'
import './setup.css'

// The mode's first screen: the three save slots, each a team's slab (its record, the year, rings) or an empty one.
export function Slots({ owner, onOpen, onHome }) {
  const rows = Array.from({ length: SLOTS_N }, (_, i) => ({ i, s: slotSummary(i) }))
  return (
    <div className="fk-root fsu fsu-slots">
      <div className="fsu-top">
        <button type="button" className="fsu-x" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
        <span className="fsu-slots-gm">{owner.toUpperCase()} · GENERAL MANAGER</span>
      </div>
      <div className="fsu-body">
        <div>
          {FRANCHISE_ART.hero && <img className="fsu-hero" src={FRANCHISE_ART.hero} alt="" width="1280" height="720" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />}
          <Chyron tone="ink" size="l" title="Franchise" sub="THREE SAVE SLOTS" />
          {rows.map(({ i, s }) => {
            const t = s?.team ? TEAM[s.team] : null
            return (
              <button key={i} type="button" className={`fsu-slot${t ? '' : ' is-empty'}`} style={{ ...(t ? fkVars(s.team) : null), '--d': `${i * 60}ms` }} onClick={() => { sfx('tap'); onOpen(i) }}>
                <span className="fsu-slot-n">{i + 1}</span>
                {t ? <span className="fsu-slot-logo"><KLogo s={s.team} size={92} /></span> : null}
                <span className="fsu-slot-txt">
                  <small>{t ? t.name.replace(` ${t.nick}`, '').toUpperCase() : s?.setup ? 'NEW FRANCHISE' : 'SLOT ' + (i + 1)}</small>
                  <b>{t ? t.nick.toUpperCase() : s?.setup ? 'SETTING UP' : 'EMPTY'}</b>
                  <em>{s?.setup ? 'PICK UP WHERE YOU LEFT IT' : s ? `${s.year} · ${s.rec} · ${s.phase === 'season' ? `WEEK ${(s.wk ?? 0) + 1}` : s.phase === 'playoffs' ? 'PLAYOFFS' : 'OFFSEASON'}${s.rings ? ` · ${s.rings} RING${s.rings > 1 ? 'S' : ''}` : ''}${s.sandbox ? ' · SANDBOX' : ''}` : 'START A FRANCHISE'}</em>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Sandbox's ADD A PROSPECT, back from the build page: he's in this year's class; name him (a prospect has no
// number until he's drafted and signs).
export function ProspectNamer({ F, B, owner, onDone }) {
  const taken = useMemo(() => new Map(), [])
  return (
    <div className="fk-root fsu fsu-sheet" role="dialog" aria-label="Name the prospect">
      <div className="fsu-body">
        <div>
          <Chyron team={F.team} tag="DRAFT CLASS" title="Name the prospect" sub="SANDBOX" />
          <NameForm pos={B.pos} build={B.build} team={F.team} taken={taken} owner={owner} showNum={false} faceKey={`${F.seed}-prospect-${F.builds.indexOf(B)}`} cta="Add him to the class" onDone={x => onDone(x.name, x.face)} />
        </div>
      </div>
    </div>
  )
}
