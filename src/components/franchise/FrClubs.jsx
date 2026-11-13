import { useMemo, useRef, useState } from 'react'
import { Panel, FrTable, FrSheet, Seg, Logo } from './frUi'
import { Fact, CoachBlock, TeamCell, up, cap, ord, plural, shortName, safe, STATE_NOUN } from './frBits'

// FRANCHISE: the league's 32 clubs and what each one is doing.
//   FrClubs     LEAGUE · TEAMS: every club with its state (CONTENDING / RETOOLING / REBUILDING), record, roster
//               rank, cap room and picks in the next draft; the row above the table narrows it to one state
//   ClubSheet   a club's page: where it is and why, its units, its staff, its needs, its picks, its roster
//               (a row opens the player), and TALK TRADE (LEAGUE · MARKET with that club across the table)
// All of it is the engine's read: FR.leagueStates, teamState, teamInfo, teamNeeds, roster.

const UNITS = [['passOff', 'PASS OFFENSE'], ['rushOff', 'RUN OFFENSE'], ['passDef', 'PASS DEFENSE'], ['rushDef', 'RUN DEFENSE'], ['ptsFor', 'POINTS FOR'], ['ptsAgainst', 'POINTS ALLOWED']]

export function ClubSheet({ FR, F, short, onClose, onPlayer, go = null }) {
  const data = useMemo(() => {
    if (!short) return null
    return { st: safe(() => FR.teamState(F, short)), info: safe(() => FR.teamInfo(F, short)), needs: safe(() => FR.teamNeeds(F, short), []), roster: safe(() => FR.roster(F, short), []) }
  }, [FR, F, short])
  const kept = useRef(null)
  if (data) kept.current = data
  const d = data ?? kept.current
  const st = d?.st, info = d?.info
  const t = st ?? info
  const mine = t?.short === F.team
  const open = safe(() => FR.tradeBlock(F).open, true)
  const needs = (d?.needs ?? []).filter(n => n.level > 0).slice(0, 6)
  const picks = info?.picks ?? []
  const whens = [...new Set(picks.map(p => p.when))]
  const staff = st?.staff ?? info?.staff
  return (
    <FrSheet open={!!data && !!t} onClose={onClose} label={t?.name}
      head={t && <span className="fr-clubhead"><Logo team={t.short} size={52} /><span className="fr-sheet-who"><b>{up(t.name)}</b><small>{[info?.record ?? st?.record, info?.standing ? up(info.standing) : null, info?.seed ? `${up(ord(info.seed))} SEED` : null].filter(Boolean).join(' · ')}</small></span></span>}
      foot={!mine && go ? <button className="fr-btn" disabled={!open} onClick={() => { onClose(); go('league', { view: 'market', sub: 'build', team: t.short }) }}>{open ? 'TALK TRADE' : 'THE DEADLINE HAS PASSED'}</button> : null}>
      {t && <>
        {st && (
          <Panel title="Where they are">
            <Fact label="STATE" strong>{st.label}<small>{st.stateText}</small></Fact>
            <Fact label="WINDOW">{st.window?.text}</Fact>
            <Fact label="QUARTERBACK">{cap(st.qb?.text)}</Fact>
            <Fact label="HARDEST PART">{st.hardest}</Fact>
            <Fact label="BUILT ON">{st.upside}</Fact>
            <Fact label="CAP ROOM">{FR.moneyText(st.capSpace)}<small>{st.capText}</small></Fact>
            <Fact label="DRAFT">{st.draft?.text}</Fact>
          </Panel>
        )}
        {info?.units && (
          <Panel title="Units" meta={info.units.passOff?.projected ? 'PROJECTED' : 'PER GAME'}>
            {UNITS.map(([k, label]) => info.units[k] && <div key={k} className="fr-kv"><span>{label}</span><b className="is-text">{info.units[k].val} · {up(ord(info.units[k].rank))}</b></div>)}
          </Panel>
        )}
        {needs.length > 0 && (
          <Panel title="Needs">
            {needs.map(n => <div key={n.slot} className="fr-kv"><span>{n.slot} · {n.word}</span><b className="is-text">{n.starter ? `${n.starter.name}, ${n.starter.ovr}` : 'Nobody'} · {up(ord(n.rank))}</b></div>)}
          </Panel>
        )}
        {staff && (
          <Panel title="Staff">
            <CoachBlock c={staff.hc} /><CoachBlock c={staff.oc} /><CoachBlock c={staff.dc} />
          </Panel>
        )}
        {picks.length > 0 && (
          <Panel title="Draft picks" meta={plural(picks.length, 'PICK')}>
            {whens.map(w => <Fact key={w} label={up(String(w).replace(/^the /, ''))}>{picks.filter(p => p.when === w).map(p => `${ord(p.round)}${p.own ? '' : ` (${p.orig.short})`}`).join(' · ')}</Fact>)}
          </Panel>
        )}
        <Panel title="Roster" meta={`${d.roster.length} MEN`}>
          <FrTable className="fr-table--tight" label="Roster" rows={d.roster} onRow={r => onPlayer(r.id)} rowClass={r => (r.starter ? '' : 'is-bench')}
            cols={[{ k: 'pos', label: 'POS', w: 42, cls: 'fr-t-pos', render: r => r.at ?? r.slot },
              { k: 'name', label: 'PLAYER', cls: 'fr-t-name', val: r => r.short, render: r => <>{shortName(r.name)}{r.inj && <i className="is-out">{r.inj.status === 'QUESTIONABLE' ? 'Q' : r.inj.status}</i>}{r.flags?.block && <i>BLOCK</i>}</> },
              { k: 'age', label: 'AGE', align: 'r', w: 34, val: r => r.age },
              { k: 'ovr', label: 'OVR', align: 'r', w: 38, cls: 'fr-t-num', val: r => r.ovr },
              { k: 'sal', label: 'PAY', align: 'r', w: 58, val: r => r.salary, render: r => FR.moneyText(r.salary) },
              { k: 'yrs', label: 'YRS', align: 'r', w: 32, val: r => r.yrs }]} />
        </Panel>
      </>}
    </FrSheet>
  )
}

export default function FrClubs({ FR, F, wide, onClub }) {
  const all = useMemo(() => safe(() => FR.leagueStates(F)), [FR, F])
  const [which, setWhich] = useState('all')
  const rows = which === 'all' ? all?.all ?? [] : all?.[which] ?? []
  const n = k => all?.[k]?.length ?? 0
  const cols = [
    { k: 'team', label: 'TEAM', val: r => r.name, render: r => <TeamCell t={r} name={wide} /> },
    { k: 'rec', label: 'W-L', align: 'r', w: wide ? 70 : 46, cls: 'fr-t-num', render: r => r.record },
    { k: 'st', label: 'STATE', w: wide ? 130 : 86, cls: 'fr-t-lab fr-t-gap', val: r => ['contend', 'retool', 'rebuild'].indexOf(r.state), desc: false, render: r => r.label },
    { k: 'rk', label: wide ? 'ROSTER' : 'RK', title: 'Roster rank', align: 'r', w: wide ? 80 : 34, val: r => r.ratings?.rank ?? 99, desc: false, render: r => (wide ? up(ord(r.ratings?.rank ?? 0)) : r.ratings?.rank) },
    ...(wide ? [{ k: 'qb', label: 'QUARTERBACK', cls: 'fr-t-dim', render: r => (r.qb?.name ? `${r.qb.name}, ${r.qb.grade}` : '–') }] : []),
    { k: 'cap', label: wide ? 'CAP ROOM' : 'ROOM', align: 'r', w: wide ? 96 : 60, val: r => r.capSpace, render: r => FR.moneyText(r.capSpace) },
    ...(wide ? [{ k: 'pk', label: 'PICKS · FIRSTS', title: 'Picks in the next draft · first-rounders', align: 'r', w: 130, cls: 'fr-t-dim', val: r => r.draft?.value ?? 0, render: r => `${r.draft?.picks ?? 0} · ${r.draft?.firsts ?? 0}` }] : [{ k: 'qb', label: 'QB', align: 'r', w: 34, cls: 'fr-t-num', val: r => r.qb?.ovr ?? 0, render: r => r.qb?.grade ?? '–' }]),
  ]
  return (
    <Panel title="The 32" meta={which === 'all' ? null : plural(rows.length, 'CLUB')}>
      <Seg className="fr-seg--fit" label="State" options={[['all', 'ALL'], ['contend', `${STATE_NOUN.contend} ${n('contend')}`], ['retool', `${STATE_NOUN.retool} ${n('retool')}`], ['rebuild', `${STATE_NOUN.rebuild} ${n('rebuild')}`]]} value={which} onChange={setWhich} />
      <FrTable key={which} className="fr-table--tight" label="Clubs" cols={cols} rows={rows} rowKey={r => r.short} sort={{ k: which === 'all' ? 'st' : 'rk', desc: false }} rowClass={r => (r.user ? 'is-mine' : null)} onRow={r => onClub(r.short)} empty="NO CLUBS IN THAT STATE" />
    </Panel>
  )
}
