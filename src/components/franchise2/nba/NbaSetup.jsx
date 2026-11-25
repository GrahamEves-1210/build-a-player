import { useEffect, useMemo } from 'react'
import { TEAM, DIVS, CONF_DIVS, DIV_OF, CONF_NAME, CONF_OF, buildTeams, teamOvr, depthOrder, photoOf, FIRST_YEAR, NC } from '../../../lib/franchise2/nba'
import { CAP_SIM } from '../../../lib/franchise2/nba'
import { lastSeason } from '../../../lib/franchise2/nba/setup'
import { sfx, haptic } from '../../../lib/juice'
import { IconClose, IconCaret } from '../../app/icons'
import { GamesSwitch } from '../../simFlow'
import { Chyron, KLogo, fkVars, TeamSlab, BigNum, Fact, LowerThird, Go } from '../kit'
import { PaceStep } from '../Setup'
import { CoachSpin, StylePick, CoachWho } from '../CoachBuild'
import { NBA_COACH, nbaCoachPhoto } from './nbaCoachLg'
import { NbaBuildsStep, NbaNameStep } from './NbaBuilds'
import NbaHire from './NbaHire'
import '../setup.css'

// BASKETBALL FRANCHISE, the setup: football's five steps (Setup.jsx), in the NBA's terms.
//   0 THE MODE    FULL or LIGHT (kept on the save: F.pace), the league rules and key moments
//   1 THE TEAM    the 30 logos by division; a team's card: last season, its OVR, its rank, its payroll, its real head
//                 coach, its stars
//   2 PLAYERS     up to three of the GM's own builds (a guard or a big), built on the build page and named here
//   3 THE COACH   spun from the league's real head coaches (CoachBuild.jsx with nbaCoachLg.js), a style, a name, a face
//   4 THE HIRE    the coach card and his staff: keep the men in the jobs or interview and hire others (NbaHire.jsx)
// The setup is saved in its slot after every change (NbaFranchise putSetup).
const STEPS = [['pace', 'MODE'], ['team', 'TEAM'], ['builds', 'PLAYERS'], ['coach', 'COACH'], ['hire', 'HIRE']]
const GROUP = { pace: 'pace', team: 'team', card: 'team', builds: 'builds', coach: 'coach', style: 'coach', who: 'coach', hire: 'hire' }
const BACK = { team: 'pace', card: 'team', builds: 'card', coach: 'builds', style: 'coach', who: 'style', hire: 'who' }
// (a setup saved before the mode step, on the team wall with no pace yet, closes from there as it did)
const firstStep = S => (S.step ?? 'team') === 'pace' || ((S.step ?? 'team') === 'team' && !S.pace)
const NBA_PACES = [
  ['full', 'FULL', 'Play the season night by night and run every offseason stop yourself.'],
  ['light', 'LIGHT', 'The season in a few stretches and the summer in a few steps.'],
]
export const GAMES_MODES = [['advanced', 'ADVANCED'], ['simple', 'SIMPLE'], ['off', 'NONE']]
export const GAMES_WHAT = { advanced: 'Play the full mini game', simple: 'One tap to time it', off: 'Sim the play' }
export const CAP_WHAT = { on: 'The NBA cap and tax', off: 'No cap, no tax' }
// Key moments in the league rules' look (rules.css .fr-rule: the setup doesn't load the hub's season.css), three across
export const GAMES_CLS = { root: 'fr-rule', top: 'fr-rule-top', group: 'fr-rule-seg nb-seg3' }
const rulesIn = S => ({ cap: S.rules?.cap ?? true, inj: S.rules?.inj ?? true })

let PREVIEW = null
export function preview() {
  if (!PREVIEW) { const F = { seed: 'preview', nid: 1, year: FIRST_YEAR }; buildTeams(F, { dealOnLoad: CAP_SIM.dealOnLoad }); PREVIEW = F }
  return PREVIEW
}
const ORDER = Object.values(CONF_DIVS).flat().flatMap(d => DIVS[d])

export default function NbaSetup({ setup, owner, put, onStart, onBack, onBuild }) {
  const S = setup
  // (a setup saved by the three-step version on its last step, the rules: on to the coach)
  const step = S.step === 'rules' ? 'coach' : S.step ?? 'team'
  const go = (patch, s) => { put({ ...S, ...patch }); if (s) sfx(s) }
  const naming = S.naming && S.builds?.[S.naming] ? S.naming : null
  // the coach build: one per team (his own team's coach is never on the wheel)
  useEffect(() => {
    if (step === 'coach' && S.team && (!S.cb || S.cb.team !== S.team)) put({ ...S, cb: NC.newCoachBuild(`${S.seed}-coach`, S.team) })
  }, [step, S.team]) // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => {
    if (naming) return go({ naming: null }, 'back')
    if (step === 'hire' && S.hsel != null) return go({ hsel: null }, 'back')
    if (step === 'hire' && S.hk) return go({ hk: null, hsel: null, hlast: S.hk }, 'back')
    if (firstStep(S)) return onBack()
    go({ step: BACK[step] }, 'back')
  }
  const at = STEPS.findIndex(([k]) => k === GROUP[step])
  const games = <GamesSwitch mode={S.games ?? 'advanced'} modes={GAMES_MODES} what={GAMES_WHAT} title="Key moments" sub="the last possession of a close game" onPick={m => go({ games: m })} cls={GAMES_CLS} />
  const closing = firstStep(S) && !naming
  return (
    <div className="fk-root fsu nb-setup" style={S.team && step !== 'team' && step !== 'pace' ? fkVars(S.team) : undefined}>
      <div className="fsu-top">
        <button type="button" className="fsu-x" onClick={back} aria-label={closing ? 'Close' : 'Back'}>
          {closing ? <IconClose size={16} /> : <IconCaret dir="left" size={18} />}
        </button>
        <ol className="fsu-steps" aria-label="New franchise">
          {STEPS.map(([k, label], i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-on' : ''}><b>{i + 1}</b>{label}</li>)}
        </ol>
      </div>
      <div className="fsu-body" key={naming ? `n-${naming}` : `${step}${S.hk ?? ''}${S.hsel ?? ''}`}>
        {naming ? <NbaNameStep S={S} id={naming} owner={owner} onDone={x => go({ naming: null, builds: { ...S.builds, [naming]: { ...S.builds[naming], ...x } } }, 'claim')} />
          : step === 'pace' ? <PaceStep pick={S.pace} paces={NBA_PACES} onPick={p => { go({ pace: p, step: 'team' }, 'tap'); haptic('light') }} rules={rulesIn(S)} capWhat={CAP_WHAT} onRules={r => go({ rules: { ...rulesIn(S), ...r } }, 'tap')} extra={games} />
            : step === 'team' ? <TeamWall pick={S.team} onPick={t => go({ team: t, step: 'card' }, 'tap')} />
              : step === 'card' ? <TeamCard s={S.team} onPick={t => go({ team: t }, 'tap')} onGo={() => { go({ step: 'builds' }, 'whistle'); haptic('medium') }} />
                : step === 'builds' ? <NbaBuildsStep S={S} go={go} owner={owner} onBuild={onBuild} onNext={() => go({ step: 'coach' }, 'whistle')} />
                  : step === 'coach' ? (S.cb?.team === S.team ? <CoachSpin S={S} go={go} lg={NBA_COACH} onDone={() => go({ step: 'style' }, 'whistle')} /> : null)
                    : step === 'style' ? <StylePick S={S} go={go} lg={NBA_COACH} onDone={() => go({ step: 'who' }, 'tap')} />
                      : step === 'who' ? <CoachWho S={S} go={go} owner={owner} lg={NBA_COACH} onDone={() => go({ step: 'hire' }, 'whistle')} />
                        : step === 'hire' && S.cb && NC.linesDone(S.cb) ? <NbaHire S={S} go={go} owner={owner} onStart={onStart} rules={rulesIn(S)} onRules={r => go({ rules: { ...rulesIn(S), ...r } })} games={games} /> : null}
      </div>
    </div>
  )
}

function TeamWall({ pick, onPick }) {
  return (
    <div className="fsu-wall">
      <Chyron tone="ink" title="Pick a team" sub="30 TEAMS · 6 DIVISIONS" />
      {Object.entries(CONF_DIVS).map(([c, ds]) => ds.map((d, i) => (
        <div key={d} className="fsu-div" style={{ '--d': `${i * 30}ms` }}>
          <span className="fsu-div-lbl">{`${CONF_NAME[c]} · ${d}`.toUpperCase()}</span>
          <div className="fsu-div-row nb-div-row">
            {DIVS[d].map(s => (
              <button key={s} type="button" className={`fsu-tm${pick === s ? ' is-on' : ''}`} style={fkVars(s)} onClick={() => onPick(s)} aria-label={TEAM[s].name}>
                <KLogo s={s} size={44} />
                <small>{s}</small>
              </button>
            ))}
          </div>
        </div>
      )))}
    </div>
  )
}

const money = v => `$${(Math.round(v * 10) / 10).toFixed(1)}M`
function TeamCard({ s, onPick, onGo }) {
  const F = preview()
  const ovr = teamOvr(F, s)
  const stars = depthOrder(F, s).slice().sort((a, b) => b.o - a.o).slice(0, 3)
  const pay = CAP_SIM.capSheet(F, s)
  const hc = NC.realHC(s)
  const ls = lastSeason(s)
  const i = ORDER.indexOf(s)
  const prev = ORDER[(i + 29) % 30], next = ORDER[(i + 1) % 30]
  const rank = useMemo(() => Object.keys(TEAM).sort((a, b) => teamOvr(F, b) - teamOvr(F, a)).indexOf(s) + 1, [s]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fsu-card" key={s}>
      <div className="fsu-card-nav">
        <button type="button" onClick={() => onPick(prev)} aria-label={TEAM[prev].name}><IconCaret dir="left" size={14} /><KLogo s={prev} size={22} />{prev}</button>
        <span>{`${CONF_OF[s] === 'E' ? 'EAST' : 'WEST'} · ${DIV_OF[s].toUpperCase()}`}</span>
        <button type="button" onClick={() => onPick(next)} aria-label={TEAM[next].name}>{next}<KLogo s={next} size={22} /><IconCaret dir="right" size={14} /></button>
      </div>
      {/* (last season on the slab, football's card: the record, how it ended) */}
      <TeamSlab s={s} size="l" rec={ls?.rec} sub={ls ? `${ls.season} SEASON` : `${CONF_NAME[CONF_OF[s]].toUpperCase()} CONFERENCE`} />
      {ls && <div className="fsu-last">{ls.div && <b>{ls.div} DIVISION CHAMPIONS</b>}<span className={ls.champ ? 'is-gold' : ''}>{ls.end}</span></div>}
      <div className="fsu-card-nums">
        <BigNum v={ovr} label="TEAM OVR" size={58} />
        <Fact v={`${rank}${ORD(rank)}`} label="IN THE NBA" size={40} />
        <Fact v={money(pay.pay)} label="PAYROLL" size={40} />
      </div>
      {hc && (
        <>
          <Chyron tone="ink" size="s" title="Head coach" />
          <LowerThird name={hc.name} pos="HC" team={s} photo={nbaCoachPhoto({ n: hc.name, real: 1, ...(hc.shot && { shot: `${hc.espn}.${hc.shot === 'png' ? 'png' : 'jpg'}` }) }, s)} stat={{ v: NC.coachGrade(hc.attrs), label: 'GRADE' }} line={hc.since >= FIRST_YEAR ? 'FIRST SEASON' : `SINCE ${hc.since}`} delay={60} />
        </>
      )}
      <Chyron tone="ink" size="s" title="Best players" />
      <div className="fsu-stars">
        {stars.map((p, k) => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={photoOf(p.n)} team={s} size="s" line={`AGE ${p.ag}`} delay={120 + k * 60} />)}
      </div>
      <div className="fsu-acts"><Go onClick={onGo}>{`Take over the ${TEAM[s].nick}`}</Go></div>
    </div>
  )
}
const ORD = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
