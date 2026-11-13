import { useEffect, useState } from 'react'
import { Bug, FrShell, Panel, FrTable, FrSheet, FrSheetHead, GradeRow, Confirm, FrMeters, FrTicker, Steps, Switch, Seg, Stepper, Logo } from './frUi'
import { FR_TEAMS, dressFor, teamOf } from './frTeams'
import FrWeek from './FrWeek'

// FRANCHISE: the kit on one page, with made-up figures. Dev server only (/?franchise=1&frkit=KC, any club's
// short): the place to look at every shared piece in any team's colour before using it on a real screen.
// It is not part of the game: FranchiseMode loads it only when the address asks, and only on the dev server.

const ROWS = [
  { id: 1, pos: 'QB', name: 'Patrick Mahomes', age: 31, ovr: 97, dev: 'ELITE', sal: 45.0, yrs: 5, mood: 92, tag: null },
  { id: 2, pos: 'RB', name: 'Tavon Whitaker', age: 22, ovr: 81, dev: 'STAR', sal: 1.1, yrs: 4, mood: 84, tag: 'BUILT' },
  { id: 3, pos: 'WR', name: 'Xavier Worthy', age: 23, ovr: 84, dev: 'STAR', sal: 3.4, yrs: 2, mood: 71, tag: null },
  { id: 4, pos: 'TE', name: 'Travis Kelce', age: 37, ovr: 86, dev: 'NORMAL', sal: 17.1, yrs: 1, mood: 55, tag: null },
  { id: 5, pos: 'LT', name: 'Josh Simmons', age: 23, ovr: 79, dev: 'SUPER', sal: 3.6, yrs: 3, mood: 66, tag: null },
  { id: 6, pos: 'EDGE', name: 'George Karlaftis', age: 25, ovr: 85, dev: 'STAR', sal: 22.0, yrs: 4, mood: 18, tag: 'OUT 3' },
  { id: 7, pos: 'DT', name: 'Chris Jones', age: 32, ovr: 93, dev: 'ELITE', sal: 31.8, yrs: 3, mood: 77, tag: null },
  { id: 8, pos: 'CB', name: 'Trent McDuffie', age: 26, ovr: 91, dev: 'SUPER', sal: 13.6, yrs: 1, mood: 40, tag: null },
]
const money = v => `$${v.toFixed(1)}M`
const COLS = [
  { k: 'pos', label: 'POS', w: 44, cls: 'fr-t-pos', val: r => r.pos },
  { k: 'name', label: 'PLAYER', cls: 'fr-t-name', val: r => r.name, render: r => <>{r.name.replace(/^(\S)\S*\s/, '$1. ')}{r.tag && <i className={/OUT/.test(r.tag) ? 'is-out' : undefined}>{r.tag}</i>}</> },
  { k: 'age', label: 'AGE', align: 'r', w: 34, val: r => r.age },
  { k: 'ovr', label: 'OVR', align: 'r', w: 38, cls: 'fr-t-num', val: r => r.ovr },
  { k: 'dev', label: 'DEV', w: 50, cls: 'fr-t-lab fr-t-dim', val: r => r.dev },
  { k: 'sal', label: 'SALARY', align: 'r', w: 62, val: r => r.sal, render: r => money(r.sal) },
  { k: 'yrs', label: 'YRS', align: 'r', w: 30, val: r => r.yrs },
  { k: 'mood', label: 'MOOD', align: 'r', w: 48, val: r => r.mood, render: r => <Steps value={r.mood} /> },
]
const NEWS = ['Chiefs activate Hollywood Brown from injured reserve ahead of Sunday night', 'Bills hold on in overtime, 27-24, to stay unbeaten', 'Jets fire their offensive coordinator after an 0-4 start', 'Lions edge rusher out four to six weeks with a high ankle sprain']
const TABS = [{ id: 'hub', label: 'HUB', n: 2 }, { id: 'team', label: 'TEAM' }, { id: 'league', label: 'LEAGUE' }, { id: 'office', label: 'OFFICE' }]

// the plain week (FrWeek.jsx) on made-up numbers: /?franchise=1&frkit=week
const ref = short => ({ short, name: teamOf(short).name, nick: teamOf(short).nick })
const pl = (name, rest, built = false) => ({ id: name, name, built, ...rest })
const side = (short, score, quarters, built) => ({
  team: ref(short), score, quarters,
  totals: { yds: 300 + score * 4, passYds: 214 + score * 3, rushYds: 86 + score, firstDowns: 17 + (score >> 3), third: '6-13', to: score > 25 ? 0 : 2, sacks: 2, top: score > 25 ? '31:42' : '28:18' },
  passing: [pl(built ? 'Tavon Whitaker' : 'Josh Allen', { cmp: 22, att: 33, yds: 268, td: 2, int: score > 25 ? 0 : 1 }, built)],
  rushing: [pl('Isiah Pacheco', { att: 17, yds: 74, td: 1, long: 19 }), pl(built ? 'Tavon Whitaker' : 'Josh Allen', { att: 5, yds: 31, td: 0, long: 14 }, built)],
  receiving: [pl('Xavier Worthy', { rec: 7, yds: 104, td: 1, long: 41 }), pl('Travis Kelce', { rec: 6, yds: 62, td: 1, long: 18 }), pl('Rashee Rice', { rec: 5, yds: 58, td: 0, long: 22 })],
  defense: [pl('Nick Bolton', { tkl: 9, sack: 0, int: 0, ff: 0 }), pl('Chris Jones', { tkl: 4, sack: 1.5, int: 0, ff: 1 }), pl('Trent McDuffie', { tkl: 5, sack: 0, int: 1, ff: 0 })],
  kicking: [pl('Harrison Butker', { fgm: 2, fga: 2, long: 48, xpm: 3, xpa: 3, pts: 9 })],
})
const BOX = { id: 'w5g3', week: 5, ot: false, away: side('KC', 27, [7, 10, 3, 7], true), home: side('BUF', 24, [3, 14, 0, 7], false) }
const game = (a, as, h, hs, ot = false, user = false) => ({ id: `${a}${h}`, week: 5, away: ref(a), home: ref(h), as, hs, ot, played: true, user })
const WEEK = {
  week: 5, label: 'WEEK 5',
  user: { game: game('KC', 27, 'BUF', 24, false, true), box: BOX, potg: { player: { name: 'Tavon Whitaker' }, line: '22 of 33, 268 yards, 2 TD' } },
  injuries: [{ id: 1, name: 'George Karlaftis', slot: 'EDGE', what: 'High ankle sprain', wk: 3, user: true }],
  scores: [game('KC', 27, 'BUF', 24, false, true), game('DAL', 17, 'PHI', 31), game('DET', 34, 'GB', 31, true), game('SF', 20, 'SEA', 23), game('NYJ', 10, 'MIA', 13), game('BAL', 28, 'CIN', 24)],
  headlines: [{ id: 1, head: 'Chiefs win in Buffalo behind Whitaker, 27-24' }, { id: 2, head: 'Lions outlast the Packers in overtime' }, { id: 3, head: 'Jets fall to 0-5; the head coach is on the hot seat' }],
}
const FAKE = { lastWeek: () => WEEK }

export default function FrKit({ team: team0 = 'KC', onHome }) {
  const [team, setTeam] = useState(team0 === 'week' ? 'KC' : team0)
  useEffect(() => { dressFor(team0 === 'week' ? 'KC' : team0) }, [team0])
  const [tab, setTab] = useState('hub')
  const [sheet, setSheet] = useState(null)
  const [ask, setAsk] = useState(false)
  const [sw, setSw] = useState(true)
  const [seg, setSeg] = useState('AFC')
  const [m, setM] = useState({ p: 70, pw: null, i: 46, iw: null })
  if (team0 === 'week') return <FrWeek FR={FAKE} F={{}} hub={{ team: ref('KC'), record: { text: '4-1' } }} onDone={onHome} />
  const at = FR_TEAMS.findIndex(t => t.short === team)
  const go = by => { const t = FR_TEAMS[(at + by + FR_TEAMS.length) % FR_TEAMS.length].short; setTeam(t); dressFor(t) }
  return (
    <>
      <FrShell tab={tab} onTab={setTab} tabs={TABS}
        bug={<Bug team={team} cells={[{ label: '2026 WEEK', value: '5' }, { label: 'RECORD', value: '3-1' }, { label: 'NEXT', value: '@ BUF', logo: 'BUF' }]} onExit={onHome} />}
        cta={<button className="fr-btn">PLAY WEEK 5</button>}>
        <div className="fr-page">
          <div className="fr-cols">
            <div className="fr-col">
              <Panel title="Team colour" meta={`${at + 1} OF 32`}><Stepper label={FR_TEAMS[at].name.toUpperCase()} onPrev={() => go(-1)} onNext={() => go(1)} /></Panel>
              <FrTicker items={NEWS} />
              <Panel title="This week" meta="WEEK 5 OF 18">
                <button className="fr-row"><span className="fr-row-main">Gameplan</span><span className="fr-row-state is-due">SET IT</span><span className="fr-chev" /></button>
                <button className="fr-row"><span className="fr-row-main">Practice</span><span className="fr-row-state is-done">HALF PADS</span><span className="fr-chev" /></button>
                <button className="fr-row"><span className="fr-row-main">Karlaftis is questionable</span><span className="fr-row-state">STAFF DECIDES</span><span className="fr-chev" /></button>
              </Panel>
              <Panel title="Roster" meta="46 ACTIVE">
                <FrTable cols={COLS} rows={ROWS} sort={{ k: 'ovr', desc: true }} onRow={setSheet} rowClass={r => (r.tag === 'BUILT' ? 'is-mine' : null)} label="Roster" />
              </Panel>
            </div>
            <div className="fr-col">
              <FrMeters a={{ label: 'PATIENCE', value: m.p, was: m.pw }} b={{ label: 'INTEREST', value: m.i, was: m.iw, team: true }} />
              <Panel title="Buttons">
                <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                  <button className="fr-btn fr-btn--wide" onClick={() => setM(v => ({ p: Math.max(0, v.p - 14), pw: v.p, i: Math.min(100, v.i + 9), iw: v.i }))}>MAKE THE OFFER</button>
                  <button className="fr-btn fr-btn--line fr-btn--wide">SIM TO MY PICK</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="fr-btn fr-btn--danger fr-btn--sm" onClick={() => setAsk(true)}>DELETE</button>
                    <button className="fr-btn fr-btn--line fr-btn--sm">DELEGATE</button>
                    <button className="fr-btn fr-btn--sm" disabled>LOCKED</button>
                  </div>
                </div>
              </Panel>
              <Panel title="League settings">
                <Switch label="Play the Moments" on={sw} onChange={setSw} />
                <Switch label="Injuries" on={!sw} onChange={v => setSw(!v)} />
                <div className="fr-kv"><span>CAP ROOM</span><b>$18.4M</b></div>
                <div className="fr-kv"><span>HEAD COACH</span><b className="is-text">Andy Reid</b></div>
              </Panel>
              <Panel title="Standings" meta="AFC WEST">
                <Seg options={['AFC', 'NFC']} value={seg} onChange={setSeg} label="Conference" />
                <FrTable label="Standings" rowKey={r => r.t} rowClass={r => (r.t === team ? 'is-mine' : null)}
                  cols={[{ k: 't', label: 'TEAM', render: r => <span className="fr-t-team"><Logo team={r.t} size={22} />{r.t}</span> }, { k: 'w', label: 'W', align: 'r', w: 30, val: r => r.w }, { k: 'l', label: 'L', align: 'r', w: 30, val: r => r.l }, { k: 'pd', label: 'DIFF', align: 'r', w: 48, val: r => r.pd, render: r => (r.pd > 0 ? `+${r.pd}` : r.pd) }]}
                  rows={[{ t: 'KC', w: 3, l: 1, pd: 31 }, { t: 'LAC', w: 3, l: 1, pd: 22 }, { t: 'DEN', w: 2, l: 2, pd: -4 }, { t: 'LV', w: 1, l: 3, pd: -38 }]} />
              </Panel>
            </div>
          </div>
        </div>
      </FrShell>
      <FrSheet open={!!sheet} onClose={() => setSheet(null)} label={sheet?.name}
        head={sheet && <FrSheetHead name={sheet.name} line={`${sheet.pos} · AGE ${sheet.age} · ${sheet.dev}`} big={sheet.ovr} />}
        foot={<><button className="fr-btn fr-btn--line">TRADE BLOCK</button><button className="fr-btn">EXTEND</button></>}>
        <Panel title="Ratings">
          {[['ARM STRENGTH', 'A+', 10], ['ACCURACY', 'A', 9], ['MOBILITY', 'B+', 7], ['FOOTBALL IQ', 'S', 11], ['CLUTCH', 'A-', 8]].map(([l, g, v]) => <GradeRow key={l} label={l} grade={g} v={v} />)}
        </Panel>
        <Panel title="Contract">
          <div className="fr-kv"><span>SALARY</span><b>{sheet ? money(sheet.sal) : ''}</b></div>
          <div className="fr-kv"><span>YEARS LEFT</span><b>{sheet?.yrs}</b></div>
        </Panel>
      </FrSheet>
      <Confirm open={ask} title="Delete this franchise?" body="Chiefs · 2026 · Week 5. It can't be brought back." yes="DELETE" no="KEEP IT" danger onYes={() => setAsk(false)} onNo={() => setAsk(false)} />
    </>
  )
}
