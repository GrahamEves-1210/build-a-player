import { useMemo } from 'react'
import { standings, recText, DIVISIONS, CONFS, ROUNDS } from '../../lib/franchise2'
import { Logo, teamVars } from './bits'
import { Ladder } from './Hub'

// LEAGUE: the playoff picture (seven logos a conference), the bracket once it's on, every division as a ladder
export default function LeagueTab({ F }) {
  const S = useMemo(() => standings(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {F.po ? <Bracket F={F} /> : (
        <section className="f2-picture ag-pop">
          {CONFS.map(c => (
            <div key={c} className="f2-picture-conf">
              <span className="ag-eyebrow">{c} · IN TODAY</span>
              <div className="f2-picture-row">
                {S.seeds[c].map((s, i) => (
                  <span key={s} className={`f2-seed${s === F.team ? ' is-me' : ''}`} style={teamVars(s)}><i>{i + 1}</i><Logo s={s} size={30} /><small>{recText(S.R[s])}</small></span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {DIVISIONS.map(d => <Ladder key={d.name} F={F} div={d.name} />)}
    </>
  )
}

// The bracket: each round's games as logo against logo, the winner lit
export function Bracket({ F }) {
  const po = F.po
  if (!po) return null
  return (
    <section className="f2-bracket ag-pop" style={{ '--d': '60ms' }}>
      {po.rounds.map((games, rd) => (
        <div key={rd} className={`f2-br-round${rd === po.rd && !po.champ ? ' is-now' : ''}`}>
          <span className="ag-eyebrow">{ROUNDS[rd]}</span>
          <div className={`f2-br-games${rd === 3 ? ' is-sb' : ''}`}>
            {games.map((g, i) => {
              const done = g.hs != null, hw = done && g.hs > g.as
              const side = (s, sc, won, seed) => (
                <span className={`f2-br-side${done ? (won ? ' is-w' : ' is-l') : ''}${s === F.team ? ' is-me' : ''}`}>
                  <i>{seed}</i><Logo s={s} size={24} /><b>{done ? sc : ''}</b>
                </span>
              )
              const seedOf = s => (g.c === 'SB' ? '' : po.seeds[g.c].indexOf(s) + 1)
              return (
                <div key={i} className="f2-br-game">
                  {side(g.h, g.hs, hw, seedOf(g.h))}
                  {side(g.a, g.as, done && !hw, seedOf(g.a))}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {po.rd === 0 && !po.rounds[0].some(g => g.hs != null) && (
        <div className="f2-br-byes">
          <span className="ag-eyebrow">BYES</span>
          {CONFS.map(c => <span key={c} className={`f2-br-side${po.seeds[c][0] === F.team ? ' is-me' : ''}`}><i>1</i><Logo s={po.seeds[c][0]} size={24} /></span>)}
        </div>
      )}
    </section>
  )
}
