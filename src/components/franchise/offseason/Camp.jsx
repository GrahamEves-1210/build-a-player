import { useMemo, useState } from 'react'
import { Panel, FrTable, Confirm, Face } from '../frUi'
import { teamOf } from '../frTeams'
import MgStage from '../../app/MgStage'
import { GAMES } from '../../../lib/minigames'
import { Frame, useOff } from './frame'
import { PlayerSheet, Who, Fact, Sub, safe, up, plural, tap } from './offUi'

// OFFSEASON 8 · TRAINING CAMP. Two of the engine's stages on one rail stop:
//   'camp'  three position drills, each a combine mini game played by the group's best man on the game's own
//           stage (components/app/MgStage.jsx, in an empty stadium) or simmed; the medal is XP for every man in
//           the group (resolveDrill). Holdouts, each with the engine's own ways out (resolveHoldout).
//   'cuts'  down to the roster limit: the roster lowest first, the staff's list marked, the GM marks his own and
//           confirms (releasePlayer). Whatever is still over when the season starts, the staff cuts.

const MEDAL = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' }

function Drills() {
  const { FR, F, o, act, move } = useOff()
  const v = o.view, us = teamOf(F.team)
  const [playing, setPlaying] = useState(null)
  const d0 = v.drills[0]
  const left = v.drills.filter(d => !d.done).length
  const lines = next => { const c = FR.campView(next); return c.drills.filter(d => d.done).map(d => `${d.title}, ${d.gameTitle.toLowerCase()}: ${d.done.text}`) }
  const cast = useMemo(() => (playing ? safe(() => FR.campCast(F, playing.player.id)) : null), [FR, F, playing])
  return (
    <Frame main={{ label: 'TO THE FINAL CUT', onClick: () => move(f => FR.advanceStage(f)) }}
      side={{ label: 'DELEGATE', onClick: () => move(f => FR.advanceStage(f), 'THE STAFF RAN CAMP', 'Camp was already done.', lines) }}>
      <div className="fro-cap" role="group" aria-label="Camp">
        <span className="is-lead"><small>DRILLS LEFT</small><b>{left}/{v.drills.length}</b></span>
        <span><small>HOLDOUTS</small><b>{v.holdouts.length}</b></span>
        <span><small>CAMP ROSTER</small><b>{v.camp.count}/{v.camp.limit}</b></span>
      </div>
      <div className="fr-cols">
        <div className="fr-col">
          <Panel title="Position drills" meta={left ? `${left} TO RUN` : 'ALL RUN'}>
            {v.drills.map(d => (
              <div key={d.id} className={`fro-drill${d.done ? ' is-done' : ''}`}>
                <Face name={d.player?.name} photo={d.player ? FR.photoUrl(d.player.photo) : null} size={44} />
                <span className="fr-row-main">{d.title}<small>{d.gameTitle} · {up(d.player?.name ?? '')}</small></span>
                {d.done ? <em>{d.done.medal ? MEDAL[d.done.medal] : 'NO MEDAL'}<small>{d.done.xp} XP</small></em> : (
                  <span className="fro-btns">
                    {d.mg && GAMES[d.mg.game] && <button className="fr-btn fr-btn--sm" onClick={() => { tap(); setPlaying(d) }}>PLAY</button>}
                    <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => act(f => FR.resolveDrill(f, d.id, 'sim'), { say: true })}>SIM</button>
                  </span>
                )}
                {d.done && <p>{d.done.text}</p>}
              </div>
            ))}
            {!v.drills.length && <div className="fr-empty">NO DRILLS THIS CAMP</div>}
          </Panel>
          {d0 && (
            <Panel title="The medals">
              <Fact label="GOLD">{d0.medals.gold}</Fact>
              <Fact label="SILVER">{d0.medals.silver}</Fact>
              <Fact label="BRONZE">{d0.medals.bronze}</Fact>
            </Panel>
          )}
        </div>
        <div className="fr-col">
          <Panel title="Holdouts" meta={v.holdouts.length ? plural(v.holdouts.length, 'PLAYER') : 'EVERYONE REPORTED'}>
            {v.holdouts.map(h => (
              <div key={h.id} className="fro-hold">
                <div className="fr-row fro-man">
                  <Face name={h.name} photo={FR.photoUrl(h.photo)} size={40} />
                  <span className="fr-row-main">{h.name}<small>{h.slot} · {h.ovr} OVR · MAKES {FR.moneyText(h.salary)} · WANTS {FR.moneyText(h.wants.perYear)} OVER {plural(h.wants.years, 'YEAR')}</small></span>
                </div>
                {h.options.map(op => (
                  <div key={op.id} className="fro-opt">
                    <span className="fr-row-main">{op.label}{op.id === h.delegate && <small>WHAT THE STAFF WOULD DO</small>}</span>
                    <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => act(f => FR.resolveHoldout(f, h.id, op.id), { say: true })}>CHOOSE</button>
                    <p>{op.text}</p>
                  </div>
                ))}
              </div>
            ))}
            {!v.holdouts.length && <div className="fr-empty">NO ONE IS HOLDING OUT OF {up(us.nick)} CAMP</div>}
          </Panel>
        </div>
      </div>
      {playing?.mg && (
        <MgStage key={playing.id} {...playing.mg} def={GAMES[playing.mg.game]} cast={cast} empty
          onDone={res => {
            const score = Math.max(0, Math.min(1, res?.score ?? (res?.hit ? 1 : 0)))
            const id = playing.id
            setPlaying(null)
            act(f => FR.resolveDrill(f, id, { score }), { say: true })
          }} />
      )}
    </Frame>
  )
}

function Cuts() {
  const { FR, F, o, act, move } = useOff()
  const v = o.view, money = FR.moneyText
  const [marked, setMarked] = useState([])
  const [pid, setPid] = useState(null)
  const [ask, setAsk] = useState(false)
  const on = marked.filter(id => v.roster.some(r => r.id === id))
  const staff = new Set(v.suggested)
  const after = v.count - on.length, still = Math.max(0, after - v.limit)
  const flip = id => setMarked(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))
  const r = v.roster.find(x => x.id === pid) ?? null
  const cols = [
    { k: 'slot', label: 'POS', w: 44, cls: 'fr-t-pos', val: x => x.slot },
    { k: 'name', label: 'PLAYER', val: x => x.name, render: x => <Who name={x.name} tag={on.includes(x.id) ? 'CUT' : staff.has(x.id) ? 'STAFF' : x.built ? 'BUILT' : null} tagOut={on.includes(x.id)} sub={`AGE ${x.age}${x.exp === 0 ? ' · ROOKIE' : ''}${x.starter ? ' · STARTER' : ''}`} /> },
    { k: 'ovr', label: 'OVR', w: 40, align: 'r', cls: 'fr-t-num', desc: false, val: x => x.ovr },
    { k: 'sal', label: 'SALARY', w: 62, align: 'r', cls: 'fr-t-num', val: x => x.salary, render: x => money(x.salary) },
    { k: 'dead', label: 'DEAD', w: 58, align: 'r', cls: 'fr-t-num', val: x => x.cut?.dead ?? 0, render: x => (x.cut?.dead ? money(x.cut.dead) : '—') },
  ]
  const release = () => { setAsk(false); for (const id of on) act(f => FR.releasePlayer(f, id)); setMarked([]) }
  return (
    <Frame main={{ label: 'START THE SEASON', onClick: () => move(f => FR.advanceStage(f), still > 0 ? 'THE STAFF MADE THE LAST CUTS' : null) }}
      side={v.over > 0 ? { label: 'DELEGATE', onClick: () => move(f => FR.advanceStage(f), 'THE STAFF MADE THE CUTS', 'The roster was already at the limit.') } : null}>
      <div className="fro-cap" role="group" aria-label="The cut">
        <span className="is-lead"><small>ROSTER</small><b className={v.over ? 'fr-t-red' : undefined}>{v.count}/{v.limit}</b></span>
        <span><small>TO CUT</small><b>{v.over}</b></span>
        <span><small>MARKED</small><b>{on.length}</b></span>
        <span><small>AFTER THE CUT</small><b className={still ? 'fr-t-red' : undefined}>{after}</b></span>
      </div>
      {v.problems.length > 0 && <Panel title="The roster is short" meta="THE STAFF COVERS IT">{v.problems.map((x, i) => <p key={i} className="fro-line fr-t-red">{x}</p>)}<p className="fro-line is-dim">Whatever is still missing when the season starts, the staff signs from the free-agent list.</p></Panel>}
      <Panel title={`The cut to ${v.limit}`} meta={v.over ? `${v.over} OVER` : v.count < v.limit ? `${plural(v.limit - v.count, 'OPEN SPOT')}` : 'AT THE LIMIT'}
        action={on.length ? <button className="fr-btn fr-btn--sm" onClick={() => { tap(); setAsk(true) }}>RELEASE {on.length}</button>
          : v.suggested.length ? <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setMarked(v.suggested) }}>MARK THE STAFF'S LIST</button> : null}>
        <FrTable className="fro-fixed" cols={cols} rows={v.roster} sort={{ k: 'ovr', desc: false }} onRow={x => setPid(x.id)} rowClass={x => (on.includes(x.id) ? 'is-cutting' : staff.has(x.id) ? 'is-mine' : null)} label="Roster" />
        {still > 0 && <Sub>{still} MORE FOR THE STAFF TO CUT WHEN THE SEASON STARTS</Sub>}
      </Panel>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)}
        foot={r ? <button className={`fr-btn${on.includes(r.id) ? ' fr-btn--line' : ' fr-btn--danger'}`} onClick={() => { tap(); flip(r.id); setPid(null) }}>{on.includes(r.id) ? 'KEEP HIM' : 'MARK FOR RELEASE'}</button> : null} />
      <Confirm open={ask} danger title={`Release ${plural(on.length, 'player')}?`} yes="RELEASE" no="NOT YET" onNo={() => setAsk(false)} onYes={release}
        body={`${v.roster.filter(x => on.includes(x.id)).map(x => x.name).join(', ')}. ${money(Math.round(v.roster.filter(x => on.includes(x.id)).reduce((s, x) => s + (x.cut?.dead ?? 0), 0) * 100) / 100)} stays on the cap as dead money. They go to the free-agent list.`} />
    </Frame>
  )
}

export default function Camp() {
  const { eng } = useOff()
  return eng === 'cuts' ? <Cuts /> : <Drills />
}
