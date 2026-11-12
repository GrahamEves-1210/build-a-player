import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { NameTag } from './app/NameTag'
import { useTapGuard } from '../lib/tapGuard'
import { ATTR, TYPES } from '../data/qbs'
import { QB_SAL_COLS } from '../data/qb-salary'
import { TEAMS } from '../data/nfl-teams'
import { WR_ATTR, WRS } from '../data/wrs'
import { WR_LEGENDS } from '../data/wr-legends'
import { RBS, RB_TYPES, RB_ATTR } from '../data/rbs'
import { RB_LEGENDS } from '../data/rb-legends'
import { valToGrade, getArchetype, getArchetypeRB, getArchetypeWR, getArchetypeTE, getArchetypeDB, getArchetypeDL, getArchetypeLB, getArchetypeK, calcOVRK, calcKAllProResult, readableTextColor, calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, calcDLDpoyResult, calcLBDpoyResult, calcOLAllProResult, calcOVRWR, calcOVRTE, calcOVRRB, calcOVRDB, calcOVRDL, calcOVRLB, calcOVROL, getArchetypeOL, olBuildSpot, dlBuildSpot, nflHeadshot } from '../utils/simulation'
import { TE_ATTR, TES } from '../data/tes'
import { TE_LEGENDS } from '../data/te-legends'
import { DB_ATTR, DBS, DB_TYPES } from '../data/dbs'
import { DB_LEGENDS } from '../data/db-legends'
import { DL_ATTR, DLS, DL_TYPES } from '../data/dls'
import { DL_LEGENDS } from '../data/dl-legends'
import { LB_ATTR, LBS, LB_TYPES, LB_SILHOUETTE } from '../data/lbs'
import { LB_LEGENDS } from '../data/lb-legends'
import { OL_ATTR, OLS, OL_SILHOUETTE, olOVR } from '../data/ols'
import { OL_LEGENDS } from '../data/ol-legends'
import { K_ATTR, KS, K_TYPES, K_SILHOUETTE } from '../data/ks'
import { K_LEGENDS } from '../data/k-legends'
import HEADSHOTS from '../data/headshots.json'
import { NFL_GOAT } from '../data/nfl-goat'
import RBFigureOverlay from './RBFigureOverlay'
import WRFigureOverlay from './WRFigureOverlay'
import DBFigureOverlay from './DBFigureOverlay'
import DLFigureOverlay from './DLFigureOverlay'
import LBFigureOverlay from './LBFigureOverlay'
import OLFigureOverlay from './OLFigureOverlay'
import KFigureOverlay from './KFigureOverlay'
import QBAvatar from './QBAvatar'
import QBFigureOverlay from './QBFigureOverlay'
import SiteFooter from './SiteFooter'
import { PlayoffGame } from './LiveGame'
import MVPModal from './MVPModal'
import { IS_APP, APP_LOOK } from '../lib/platform'
// The app's season screen (moments, week strip, bracket, rewards, story) runs
// on the website too; the site keeps its in-page ads and the 32-0 promo
const APP_SIM = IS_APP || APP_LOOK
import { WeekStrip, Bracket, RingCeremony, SeasonRewards } from './app/AppSeason'
import { createDirector } from '../lib/seasonDirector'
import { MomentCard, Pulse, Wire, Milestones, RecordOverlay, Leaders, SeasonStory, useDirectedReveal, MomentsToggle } from './app/AppSeasonPlus'
import { rampAdd, useRailOn } from '../lib/ads'
import { ShareSeasonButton } from './app/SeasonShare'
import { nflSeasonCard } from '../utils/seasonCard'
import { useCountUp as countUp } from '../lib/useCountUp'
import { useOnLeave } from './simFlow'
import { offDefGrade, StatLineTable, gradeColor, GameLog, PlayoffLog } from './simParts'

// ── Helpers ──────────────────────────────────────────────────────────────────


// the shared count-up (lib/useCountUp.js); runs once there's a number to count to
const useCountUp = (target, duration = 900, enabled = true) => countUp(target, { run: enabled && !!target, ms: duration })

// ── WR Depth Chart Card ───────────────────────────────────────────────────────

function WRDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userOVR = calcOVRWR(build, types)

  const pool = isAllTime ? WR_LEGENDS : WRS
  const teamWRs = pool
    .filter(w => w.team === team.short)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 3)

  const merged = [
    ...teamWRs.map(w => ({
      name: w.name, ovr: w.ovr, isUser: false,
      photo: nflHeadshot(HEADSHOTS[w.name]),
      teamColor: TEAMS.find(t => t.short === w.team)?.color,
      teamShort: w.team,
    })),
    { name: userName, ovr: userOVR, isUser: true, photo: build['awareness']?.photo ?? null, teamColor: team.color, teamShort: team.short },
  ].sort((a, b) => b.ovr - a.ovr || (a.isUser ? 1 : -1))

  const labels = ['WR1', 'WR2', 'WR3', 'WR4']
  const rows = merged.slice(0, 4)

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{labels[i]}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

function TEDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userOVR = calcOVRTE(build, types)

  const pool = isAllTime ? TE_LEGENDS : TES
  const teamTEs = pool
    .filter(te => te.team === team.short)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 2)

  const merged = [
    ...teamTEs.map(te => ({
      name: te.name, ovr: te.ovr, isUser: false,
      photo: nflHeadshot(HEADSHOTS[te.name]),
      teamColor: TEAMS.find(t => t.short === te.team)?.color,
      teamShort: te.team,
    })),
    { name: userName, ovr: userOVR, isUser: true, photo: build['awareness']?.photo ?? null, teamColor: team.color, teamShort: team.short },
  ].sort((a, b) => b.ovr - a.ovr || (a.isUser ? 1 : -1))

  const labels = ['TE1', 'TE2', 'TE3']
  const rows = merged.slice(0, 3)

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{labels[i]}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

function RBDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userOVR = calcOVRRB(build, types)

  const pool = isAllTime ? RB_LEGENDS : RBS
  const teamRBs = pool
    .filter(rb => rb.team === team.short)
    .map(rb => ({ ...rb, ovr: calcOVRRB({ ...Object.fromEntries(RB_TYPES.map(t => [t, { val: rb.attrs?.[t] ?? 5 }])) }, RB_TYPES) }))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 2)

  const merged = [
    ...teamRBs.map(rb => ({
      name: rb.name, ovr: rb.ovr, isUser: false,
      photo: nflHeadshot(HEADSHOTS[rb.name]),
      teamColor: TEAMS.find(t => t.short === rb.team)?.color ?? team.color,
      teamShort: rb.team,
    })),
    { name: userName, ovr: userOVR, isUser: true, photo: null, teamColor: team.color, teamShort: team.short },
  ].sort((a, b) => b.ovr - a.ovr || (a.isUser ? 1 : -1))

  const labels = ['RB1', 'RB2', 'RB3']
  const rows = merged.slice(0, 3)

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{labels[i]}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

function DBDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userOVR = calcOVRDB(build, types)

  const g = k => build[k]?.val ?? 0
  // Anchor on the "size" chip's real position (same chip used for the jersey/
  // height-weight identity elsewhere) — falls back to the old stat-guess only
  // for builds saved before subpos was tracked on the chip.
  const anchorSubpos = build?.['size']?.subpos
  const isUserSafety = anchorSubpos ? anchorSubpos === 's' : (g('size') >= 8 && g('runSupport') >= 8)
  const userPhoto = types.map(t => build[t]?.photo).find(p => p) ?? null

  const withOVR = d => ({
    ...d,
    ovr: calcOVRDB(Object.fromEntries(DB_TYPES.map(t => [t, { val: d.attrs?.[t] ?? 5 }])), DB_TYPES),
  })
  const toRow = d => ({
    name: d.name, ovr: d.ovr, isUser: false,
    photo: nflHeadshot(HEADSHOTS[d.name]),
    teamColor: TEAMS.find(t => t.short === d.team)?.color ?? team.color,
    teamShort: d.team,
  })
  const userRow = { name: userName, ovr: userOVR, isUser: true, photo: userPhoto, teamColor: team.color, teamShort: team.short }

  // Always two starters per position: your build takes one of the two spots in
  // its own group (the team's best player keeps the other), so the chart is
  // always S, S, CB1, CB2 — never a CB3.
  const pool = isAllTime ? DB_LEGENDS : DBS
  const teamSafeties = pool.filter(d => d.team === team.short && d.subpos === 's').map(withOVR).sort((a, b) => b.ovr - a.ovr).slice(0, isUserSafety ? 1 : 2)
  const teamCorners  = pool.filter(d => d.team === team.short && d.subpos === 'cb').map(withOVR).sort((a, b) => b.ovr - a.ovr).slice(0, isUserSafety ? 2 : 1)

  const safetyRows = (isUserSafety ? [...teamSafeties.map(toRow), userRow] : teamSafeties.map(toRow))
    .sort((a, b) => b.ovr - a.ovr || (a.isUser ? 1 : -1))
  const cornerRows = (!isUserSafety ? [...teamCorners.map(toRow), userRow] : teamCorners.map(toRow))
    .sort((a, b) => b.ovr - a.ovr || (a.isUser ? 1 : -1))

  const rows = [
    ...safetyRows.map((row) => ({ ...row, label: 'S' })),
    ...cornerRows.map((row, i) => ({ ...row, label: `CB${i + 1}` })),
  ]

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{row.label}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

// The whole line: the team's real EDGEs and DTs, best first. The build's spot comes from
// its Size chip, where it takes the better of that group's two spots it can win by OVR.
function DLDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const spot = dlBuildSpot(build)
  const userPhoto = types.map(t => build[t]?.photo).find(p => p) ?? null
  const userRow = { name: userName, ovr: calcOVRDL(build, types), isUser: true, photo: userPhoto, teamColor: team.color, teamShort: team.short }
  const withOVR = d => ({
    ...d,
    ovr: calcOVRDL(Object.fromEntries(DL_TYPES.map(t => [t, { val: d.attrs?.[t] ?? 5 }])), DL_TYPES),
  })
  const toRow = d => ({
    name: d.name, ovr: d.ovr, isUser: false,
    photo: nflHeadshot(d.headshot ?? HEADSHOTS[d.name]),
    teamColor: TEAMS.find(t => t.short === d.team)?.color ?? team.color,
    teamShort: d.team,
  })
  const pool = isAllTime ? DL_LEGENDS : DLS
  const group = (subpos, labels) => {
    const mine = spot === subpos
    const real = pool.filter(d => d.team === team.short && d.subpos === subpos).map(withOVR).sort((x, y) => y.ovr - x.ovr).slice(0, mine ? 1 : 2).map(toRow)
    return (mine ? [...real, userRow] : real)
      .sort((x, y) => y.ovr - x.ovr || (x.isUser ? 1 : -1))
      .map((row, i) => ({ ...row, label: labels[i] }))
  }
  const rows = [...group('edge', ['LEDGE', 'REDGE']), ...group('dt', ['DT1', 'DT2'])]

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{row.label}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

// The team's real linebackers, best first: the build takes one of the three spots by OVR
function LBDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userPhoto = types.map(t => build[t]?.photo).find(p => p) ?? null
  const userRow = { name: userName, ovr: calcOVRLB(build, types), isUser: true, photo: userPhoto, teamColor: team.color, teamShort: team.short }
  const real = (isAllTime ? LB_LEGENDS : LBS).filter(d => d.team === team.short)
    .map(d => ({ ...d, ovr: calcOVRLB(Object.fromEntries(LB_TYPES.map(t => [t, { val: d.attrs?.[t] ?? 5 }])), LB_TYPES) }))
    .sort((x, y) => y.ovr - x.ovr).slice(0, 2)
    .map(d => ({
      name: d.name, ovr: d.ovr, isUser: false,
      photo: nflHeadshot(d.headshot ?? HEADSHOTS[d.name]),
      teamColor: TEAMS.find(t => t.short === d.team)?.color ?? team.color,
      teamShort: d.team,
    }))
  const labels = ['MIKE', 'WILL', 'SAM']
  const rows = [...real, userRow].sort((x, y) => y.ovr - x.ovr || (x.isUser ? 1 : -1)).map((row, i) => ({ ...row, label: labels[i] }))
  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{row.label}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

// The kicker room: the build has the job, the team's real kicker behind him
function KDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userPhoto = types.map(t => build[t]?.photo).find(p => p) ?? null
  const real = (isAllTime ? K_LEGENDS : KS).filter(d => d.team === team.short).sort((x, y) => y.ovr - x.ovr).slice(0, 1)
    .map(d => ({ name: d.name, ovr: d.ovr, isUser: false, photo: nflHeadshot(d.headshot ?? HEADSHOTS[d.name]), teamColor: team.color, teamShort: d.team }))
  const rows = [{ name: userName, ovr: calcOVRK(build, types), isUser: true, photo: userPhoto, teamColor: team.color, teamShort: team.short }, ...real].map((row, i) => ({ ...row, label: `K${i + 1}` }))
  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Depth Chart · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{row.label}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}

// Your build takes over the real starter's spot on the picked team's line — the
// spot comes from the Size chip (the same chip that sets the jersey and
// HT/WT), and the team's other four real starters fill out the rest.
const OL_SPOTS = ['LT', 'LG', 'C', 'RG', 'RT']

// All-Time: the franchise's legends line up around the build. Each takes his own spot, best first; a spot
// nobody played goes to the best legend left over from the same side of the line (a tackle at either
// tackle, a guard or center anywhere inside), and stays empty when there is none
const OL_FAMILY = { LT: 'T', RT: 'T', LG: 'I', C: 'I', RG: 'I' }
function olLegendLine(teamShort, userSpot) {
  const men = OL_LEGENDS.filter(p => p.team === teamShort).map(p => ({ ...p, ovr: Math.round(olOVR(p.attrs) ?? 0) })).sort((a, b) => b.ovr - a.ovr)
  const line = {}, used = new Set()
  for (const spot of OL_SPOTS) {
    if (spot === userSpot) continue
    const m = men.find(p => p.pos === spot && !used.has(p.name))
    if (m) { line[spot] = m; used.add(m.name) }
  }
  for (const spot of OL_SPOTS) {
    if (spot === userSpot || line[spot]) continue
    const m = men.find(p => !used.has(p.name) && OL_FAMILY[p.pos] === OL_FAMILY[spot])
    if (m) { line[spot] = m; used.add(m.name) }
  }
  return line
}

function OLDepthChart({ team, build, types, isAllTime = false, userName = 'Guest' }) {
  const userOVR  = calcOVROL(build, types)
  const buildSpot = olBuildSpot(build)
  const userSpot = OL_SPOTS.includes(buildSpot) ? buildSpot : 'LT'
  const userPhoto = types.map(t => build[t]?.photo).find(p => p) ?? null
  const legends = isAllTime ? olLegendLine(team.short, userSpot) : null

  const rows = OL_SPOTS.map(spot => {
    if (spot === userSpot) {
      return { label: spot, name: userName, ovr: userOVR, isUser: true, photo: userPhoto, teamColor: team.color, teamShort: team.short }
    }
    const o = isAllTime ? legends[spot] : OLS.find(p => p.team === team.short && p.pos === spot)
    return o ? {
      label: spot, name: o.name, ovr: o.ovr, isUser: false,
      photo: nflHeadshot(o.headshot ?? HEADSHOTS[o.name]),
      teamColor: o.color ?? team.color,
      teamShort: o.team,
    } : null
  }).filter(Boolean)

  return (
    <div className="wr-depth-chart">
      <div className="wr-dc-header">{isAllTime ? '★ All-Time ' : ''}Offensive Line · {team.short}</div>
      {rows.map((row, i) => (
        <div key={i} className={`wr-dc-row${row.isUser ? ' wr-dc-row--you' : ''}`}>
          <span className="wr-dc-pos">{row.label}</span>
          <QBAvatar photo={row.photo} team={row.teamShort} color={row.teamColor} size={28} />
          <span className="wr-dc-name">{row.name}</span>
          <span className="wr-dc-ovr">{row.ovr}</span>
        </div>
      ))}
    </div>
  )
}



// The DL figure is a wider shape than the DB's (912x1496 against 479x1028)
const DL_MODEL_STYLE = { aspectRatio: '912 / 1496', width: 230 }
// (the linebacker's figure is wider and shorter: the same height as DL's)
const LB_MODEL_STYLE = { aspectRatio: '1005 / 1267', width: 290 }
// (the lineman's figure, 888x1289: the same height again)
const OL_MODEL_STYLE = { aspectRatio: '888 / 1289', width: 256 }
// (the kicker's figure, 1199x1312, his arms out wide: the same height again, never wider than the screen)
const K_MODEL_STYLE = { aspectRatio: '1199 / 1312', width: 340, maxWidth: '100%' }

// ── Screen 1: Build Overview ──────────────────────────────────────────────────

// The build as rows: one per trait, or for QB Salary Cap one per column you
// picked (like basketball's), graded on the average of the traits it covers
function buildRows(build, types, meta, salaryQB) {
  if (salaryQB) {
    return QB_SAL_COLS.filter(c => build[c.types[0]]).map(c => {
      const vals = c.types.map(t => build[t]?.val).filter(v => v != null)
      return { key: c.key, label: c.label, data: build[c.types[0]], val: vals.reduce((a, b) => a + b, 0) / (vals.length || 1) }
    })
  }
  return types.filter(t => build[t]).map(t => ({ key: t, label: meta[t]?.label ?? t, data: build[t], val: build[t].val }))
}

function ScreenBuild({ result, build, types, onNext, isRB, isWR, isTE, isDB, isDL, isLB = false, isOL, isK = false, isSalaryMode = false }) {
  const { ovr } = result
  const archetype = isK ? getArchetypeK(ovr, build, types) : isOL ? getArchetypeOL(ovr, build, types) : isDL ? getArchetypeDL(ovr, build, types) : isLB ? getArchetypeLB(ovr, build, types) : isDB ? getArchetypeDB(ovr, build, types) : isTE ? getArchetypeTE(ovr, build, types) : isWR ? getArchetypeWR(ovr, build, types) : isRB ? getArchetypeRB(ovr, build, types) : getArchetype(ovr, build, types)
  const ovrDisplay = useCountUp(ovr, 900)
  const [rowsVisible, setRowsVisible] = useState(0)
  const filled = buildRows(build, types, isK ? K_ATTR : isOL ? OL_ATTR : isDL ? DL_ATTR : isLB ? LB_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR, isSalaryMode && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL)

  const team = result.team
  const monoTeamBuild = team
    ? Object.fromEntries(
        Object.entries(build).map(([k, v]) => [
          k,
          v ? { ...v, teamColor: team.color, teamColor2: team.color2, team: team.short } : v,
        ])
      )
    : build

  useEffect(() => {
    let i = 0
    const tick = () => {
      if (i >= filled.length) return
      i++
      setRowsVisible(i)
      setTimeout(tick, 80)
    }
    const t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="simp-screen">
      <div className="simp-ovr-hero">
        <div className="simp-ovr-num">{ovrDisplay || '–'}</div>
        <div className="simp-ovr-lbl">OVR</div>
      </div>
      <div className="simp-archetype">{archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>

      {team && (
        (isWR || isTE) ? (
          <div className="simp-team-model simp-team-model--rb">
            <div className="simp-team-model-glow" />
            <img src="/wr-silhouette.png" alt="" className="simp-sil-ghost" draggable={false} style={{ filter: 'brightness(0.55)' }} />
            <WRFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isK ? (
          <div className="simp-team-model" style={K_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={K_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <KFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isOL ? (
          <div className="simp-team-model" style={OL_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={OL_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <OLFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isLB ? (
          <div className="simp-team-model" style={LB_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={LB_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <LBFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isDL ? (
          <div className="simp-team-model" style={DL_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src="/dl-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
            <DLFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isDB ? (
          <div className="simp-team-model simp-team-model--db">
            <div className="simp-team-model-glow" />
            <img src="/db-silhouette.png" alt="" className="simp-sil-ghost" draggable={false} style={{ filter: 'brightness(0.35) drop-shadow(0 0 3px rgba(255,255,255,0.35))' }} />
            <DBFigureOverlay build={monoTeamBuild} />
          </div>
        ) : (
          <div className={`simp-team-model${isRB ? ' simp-team-model--rb' : ''}`}>
            <div className="simp-team-model-glow" />
            {isRB ? (
              <>
                <img src="/rb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
                <RBFigureOverlay build={monoTeamBuild} />
              </>
            ) : (
              <>
                <img src="/qb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
                <QBFigureOverlay build={monoTeamBuild} className="player-qbfig" />
              </>
            )}
          </div>
        )
      )}

      <div className="simp-attr-table">
        {filled.map(({ key, label, data, val }, i) => {
          return (
            <div
              key={key}
              className={`simp-attr-row${i < rowsVisible ? ' simp-row-visible' : ''}`}
            >
              <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={46} />
              <div className="simp-attr-info">
                <span className="simp-attr-name">{label}</span>
                <span className="simp-attr-qb">{data.qbFull}</span>
              </div>
              <span className="simp-grade-circle" style={{ background: gradeColor(val), color: '#07120a' }}>
                {valToGrade(val)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Screen 2 (app): the season you steer ─────────────────────────────────────
function DirectedSeason({ dr, result, pos, pool, userName, director, onNext, build, types, isOL, isK = false, isDB, isDL, isLB = false, isTE, isWR, isRB, adsDisabled = true }) {
  const games = dr.games
  const wins = games.filter(g => g.won).length, losses = games.length - wins
  const final = dr.done ? result : null
  const youValue = final ? (final[director.leaderKey ?? ''] ?? null) : null
  return (
    <>
      <div className="simp-eyebrow">Regular Season</div>
      <div className="simp-live-record">
        <span className="slr-w">{wins}</span>
        <span className="slr-sep">–</span>
        <span className="slr-l">{losses}</span>
      </div>
      <Pulse games={games} total={dr.total} playoffWins={10} />
      <Wire items={dr.headlines} />
      {/* only the moments get a card: a card per game flashed by too fast to read */}
      {dr.moment && <MomentCard moment={dr.moment} onPick={dr.choose} onTurnOff={dr.turnOff} />}
      <Milestones items={dr.fresh} />
      <WeekStrip games={director.games} revealed={dr.k} />
      <GameLog games={games} total={dr.total} isOL={isOL} isK={isK} isDB={isDB} isDL={isDL} isLB={isLB} isTE={isTE} isWR={isWR} isRB={isRB} />
      {!adsDisabled && <div id="ramp-cntr1-season" className="plf-banner-ad" style={{ minHeight: 0 }} />}
      {dr.record && <RecordOverlay record={dr.record} name={userName} onClose={dr.clearRecord} />}
      {final && (
        <div className="simp-stat-section simp-totals-in">
          {!adsDisabled && <div id="ramp-season-prod" className="simp-season-ad" />}
          <div className="simp-eyebrow">Production</div>
          <StatLineTable result={final} build={build} userName={userName} kind={isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'} />
          {pool && <Leaders sport="nfl" pos={pos} pool={pool} seed={director.seed} you={{ name: userName, team: result.team?.short, value: leaderValue(final, pos) }} />}
        </div>
      )}
      {/* outside the section above: it has to stick to the whole screen, not just that section */}
      {final && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{final.playoffs ? 'Enter Playoffs' : 'Season Summary'}</button>}
    </>
  )
}
const leaderValue = (r, pos) => pos === 'qb' ? r.seasonPassYds : pos === 'rb' ? r.seasonRushYds : pos === 'dl' ? r.seasonSacks : pos === 'lb' ? r.seasonTackles : pos === 'db' ? r.seasonINTs : pos === 'ol' ? r.seasonPancakes : pos === 'k' ? r.seasonPoints : r.seasonRecYds

// ── Screen 2: Regular Season ──────────────────────────────────────────────────

function ScreenSeason({ result, onNext, isRB = false, isWR = false, isTE = false, isDB = false, isDL = false, isLB = false, isOL = false, isK = false, adsDisabled = false, build = null, types = [], director = null, onFinal = null, pool = null, userName = 'Guest' }) {
  const { games, playoffs, hasBye } = result
  const pos = isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'
  // App: the director reveals the season and pauses on its moments
  const dr = useDirectedReveal({ director, pace: 240, onFinal })
  const { seasonPassYds, seasonTDs, seasonINTs: qbSeasonINTs, seasonRating, seasonCompPct, seasonRushYds: qbRushYds, seasonRushTDs: qbRushTDs, seasonSacks } = result
  const { seasonRushYds: rbRushYds, seasonRushTDs: rbRushTDs, seasonYPC, seasonFumbles, seasonRecYds, seasonRecTDs, seasonRecs, seasonLong, seasonYPR, seasonTargets } = result
  const { seasonINTs: dbINTs, seasonPBUs, seasonTackles, seasonTFL, seasonPickSixes } = result

  const [phase, setPhase]           = useState('loading')
  const [revealed, setRevealed]     = useState(0)
  const [liveWins, setLiveWins]     = useState(0)
  const [liveLosses, setLiveLosses] = useState(0)

  const allDone = director ? dr.done : revealed === games.length

  useEffect(() => {
    if (adsDisabled) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-season' }])
  }, [])

  useEffect(() => {
    if (!allDone || adsDisabled) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-season-prod' }])
  }, [allDone])

  useEffect(() => {
    if (director) { const t = setTimeout(() => setPhase('playing'), 600); return () => clearTimeout(t) }
    const loadTimer = setTimeout(() => {
      setPhase('playing')
      let i = 0, w = 0, l = 0

      const revealNext = () => {
        if (i >= games.length) { setPhase('done'); return }
        const g = games[i]
        if (g.won) w++; else l++
        setRevealed(i + 1)
        setLiveWins(w)
        setLiveLosses(l)
        i++
        setTimeout(revealNext, 200)
      }

      revealNext()
    }, 900)

    return () => clearTimeout(loadTimer)
  }, [])

  return (
    <div className="simp-screen">

      {phase === 'loading' && (
        <div className="simp-loading">
          <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
          <div className="simp-loading-lbl">Simulating season…</div>
        </div>
      )}

      {phase !== 'loading' && director && (
        <DirectedSeason dr={dr} result={result} pos={pos} pool={pool} userName={userName} director={director} onNext={onNext} build={build} types={types} isOL={isOL} isK={isK} isDB={isDB} isDL={isDL} isLB={isLB} isTE={isTE} isWR={isWR} isRB={isRB} adsDisabled={adsDisabled} />
      )}
      {phase !== 'loading' && !director && (
        <>
          <div className="simp-eyebrow">Regular Season</div>
          <div className="simp-live-record">
            <span className="slr-w">{liveWins}</span>
            <span className="slr-sep">–</span>
            <span className="slr-l">{liveLosses}</span>
          </div>
          {APP_SIM && <WeekStrip games={games} revealed={revealed} />}
          {allDone && (
            <div className="simp-record-sub simp-record-sub-in">
              {playoffs ? 'Playoff Bound' : 'Missed the Playoffs'}
            </div>
          )}
          {allDone && hasBye && (
            <div className="simp-bye-badge simp-record-sub-in">First Round Bye</div>
          )}

          <div className="simp-games-list">
            {games.slice(0, revealed).map(g => (
              <div key={g.wk} className={`simp-game-row ${g.won ? 'sgr-w' : 'sgr-l'} sgr-in`}>
                <span className="sgr-wk">WK {g.wk}</span>
                <span className={`sgr-badge ${g.won ? 'sgr-badge-w' : 'sgr-badge-l'}`}>{g.won ? 'W' : 'L'}</span>
                <span className="sgr-opp"><span className="sgr-venue">{g.home ? 'vs' : '@'}</span>{g.opponent}</span>
                <span className="sgr-score">{g.mySc}–{g.oppSc}</span>
                {isK ? (
                  <span className="sgr-stat">{g.fgm}/{g.fga}<span className="sgr-unit">FG</span> {g.xpm}/{g.xpa}<span className="sgr-unit">XP</span></span>
                ) : isOL ? (
                  <span className="sgr-stat sgr-stat--ol">
                    {g.sacks}<span className="sgr-unit"> sack{g.sacks !== 1 ? 's' : ''} allowed</span>
                    {' · '}{g.pancakes}<span className="sgr-unit"> pancake{g.pancakes !== 1 ? 's' : ''}</span>
                    {g.penalties > 0 && <>{' · '}{g.penalties}<span className="sgr-unit"> penalt{g.penalties !== 1 ? 'ies' : 'y'}</span></>}
                  </span>
                ) : isLB ? (
                  <span className="sgr-stat">{g.tackles}<span className="sgr-unit">TKL</span> {g.sacks}<span className="sgr-unit">SCK</span> {g.ints}<span className="sgr-unit">INT</span></span>
                ) : isDL ? (
                  <span className="sgr-stat">{g.sacks}<span className="sgr-unit">SCK</span> {g.tfl}<span className="sgr-unit">TFL</span> {g.tackles}<span className="sgr-unit">TKL</span></span>
                ) : isDB ? (
                  <span className="sgr-stat">
                    {g.ints > 0 && <>{g.ints}<span className="sgr-unit">INT</span>{g.pickSixes > 0 ? ' (TD)' : ''} </>}
                    {g.pbus}<span className="sgr-unit">PBU</span> {g.tackles}<span className="sgr-unit">TKL</span>
                    {g.ff > 0 && <> {g.ff}<span className="sgr-unit">FF</span></>}
                  </span>
                ) : (isWR || isTE) ? (
                  <span className="sgr-stat">{g.rec}<span className="sgr-unit">rec</span> {g.recYds}<span className="sgr-unit">yds</span> {g.recTDs}<span className="sgr-unit">TD</span></span>
                ) : isRB ? (
                  <span className="sgr-stat">{g.rushYds}<span className="sgr-unit">rush</span> {g.rushTDs + g.recTDs}<span className="sgr-unit">TD</span> {g.ypc}<span className="sgr-unit">YPC</span></span>
                ) : (
                  <span className="sgr-stat">{g.passYds}<span className="sgr-unit">yds</span> {g.tds}<span className="sgr-unit">TD</span> {g.ints}<span className="sgr-unit">INT</span></span>
                )}
              </div>
            ))}
          </div>

          {!adsDisabled && (
            <div id="ramp-cntr1-season" className="plf-banner-ad" style={{ minHeight: 0 }} />
          )}

          {allDone && (
            <div className="simp-stat-section simp-totals-in">
              {!adsDisabled && <div id="ramp-season-prod" className="simp-season-ad" />}
              <div className="simp-eyebrow">Production</div>
              <StatLineTable result={result} build={build} userName={userName} kind={isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'} />
            </div>
          )}

          {allDone && (
            <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>
              {playoffs ? 'Enter Playoffs' : 'Season Summary'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Screen 3: Playoffs ────────────────────────────────────────────────────────


function ScreenPlayoffs({ result, onNext, onPreSuperBowl, adsDisabled = false, nextLabel = 'Final Report' }) {
  const { wins, losses, playoffs, playoffRounds, team } = result
  const [gameIdx, setGameIdx] = useState(0)
  const [status,  setStatus]  = useState('playing')
  const [started, setStarted] = useState(false)
  const [ringOpen, setRingOpen] = useState(APP_SIM)   // app: the title moment, once the Super Bowl is won

  useEffect(() => {
    if (!playoffs) return
    const t = setTimeout(() => setStarted(true), 500)
    return () => clearTimeout(t)
  }, [playoffs])

  useEffect(() => {
    if (adsDisabled) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-plf' }])
  }, [])

  const advanceToSB = () => {
    setGameIdx(i => i + 1)
    setStatus('playing')
  }

  const handleGameDone = () => {
    const r = playoffRounds[gameIdx]
    if (!r.won) { setStatus('eliminated'); return }
    if (gameIdx === playoffRounds.length - 1) { setStatus('champion'); return }
    const nextIsSB = playoffRounds[gameIdx + 1]?.round === 'Super Bowl'
    setStatus('between')
    if (nextIsSB && onPreSuperBowl) {
      setTimeout(() => onPreSuperBowl(advanceToSB), 2500)
    } else {
      setTimeout(() => {
        setGameIdx(i => i + 1)
        setStatus('playing')
      }, 2500)
    }
  }

  const teamColor = team?.color || '#5EDBD8'
  const teamAbbr  = team?.short || 'YOU'
  const teamLogo  = team?.logo  || null

  if (!playoffs) {
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Postseason</div>
        <div className="simp-miss-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="24" r="19"/>
            <path d="M16 16l16 16M32 16L16 32"/>
          </svg>
        </div>
        <div className="simp-miss-title">Missed the Playoffs</div>
        <button className="simp-cta" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  const current = playoffRounds[gameIdx]

  let inner
  if (status === 'champion') {
    const sb = playoffRounds[playoffRounds.length - 1]
    inner = (
      <div className="simp-screen-center plf-champion-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <img src="/trophy.webp" alt="" className="sfb-trophy" />
        <div className="plf-champ-label">Super Bowl Champions</div>
        <div className="plf-champ-sub">{sb.mySc}–{sb.oppSc}{sb.overtime ? ' OT' : ''} vs {sb.opponent}</div>
        <button className="simp-cta simp-cta-in" onClick={onNext}>{nextLabel}</button>
      </div>
    )
  } else if (status === 'eliminated') {
    const r = playoffRounds[gameIdx]
    inner = (
      <div className="simp-screen-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="simp-eyebrow">Season Over</div>
        <div className="plf-elim-title">{r.round === 'Super Bowl' ? 'Lost Super Bowl' : 'Eliminated'}</div>
        <div className="plf-elim-round">{r.round === 'Super Bowl' ? '' : r.round}</div>
        <div className="plf-elim-score">{r.mySc} – {r.oppSc}{r.overtime ? ' OT' : ''} · vs {r.opponent}</div>
        <button className="simp-cta" onClick={onNext}>{nextLabel}</button>
      </div>
    )
  } else if (status === 'between') {
    const r    = playoffRounds[gameIdx]
    const next = playoffRounds[gameIdx + 1]
    inner = (
      <div className="plf-between-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="plf-bw-result">
          <span className="plf-bw-w">W</span>
          <span className="plf-bw-score">{r.mySc}–{r.oppSc}{r.overtime ? ' OT' : ''}</span>
        </div>
        <div className="plf-bw-adv">Advancing…</div>
        {next && <div className="plf-bw-next">Next up · {next.round}</div>}
      </div>
    )
  } else {
    inner = (
      <>
        <div className="simp-eyebrow">Playoffs</div>
        {!started ? (
          <div className="simp-loading">
            <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
            <div className="simp-loading-lbl">Entering Playoffs…</div>
          </div>
        ) : (
          <PlayoffGame
            key={gameIdx}
            round={current.round}
            opponent={current.opponent}
            home={current.home}
            weather={current.weather}
            mySc={current.mySc}
            oppSc={current.oppSc}
            won={current.won}
            overtime={current.overtime}
            teamColor={teamColor}
            teamAbbr={teamAbbr}
            teamLogo={teamLogo}
            isFinal={gameIdx === playoffRounds.length - 1}
            isAllTime={!!team?.isAllTime}
            onDone={handleGameDone}
          />
        )}
        {started && <PlayoffLog rounds={playoffRounds.slice(0, status === 'playing' ? gameIdx : gameIdx + 1)} />}
        {!adsDisabled && (
          <div id="ramp-cntr1-plf" className="plf-banner-ad" style={{ minHeight: 0 }} />
        )}
      </>
    )
  }

  const sbRound = playoffRounds[playoffRounds.length - 1]
  return (
    <div className="simp-screen">
      {APP_SIM && <Bracket rounds={playoffRounds} gameIdx={gameIdx} status={status} hasBye={result.hasBye} />}
      {inner}
      {APP_SIM && status === 'champion' && ringOpen && (
        <RingCeremony team={team} title="Super Bowl Champions"
          score={`${sbRound.mySc}–${sbRound.oppSc}${sbRound.overtime ? ' OT' : ''} vs ${sbRound.opponent}`}
          onClose={() => setRingOpen(false)} />
      )}
    </div>
  )
}

// ── Screen 4: Final Report ────────────────────────────────────────────────────

// ─── GOAT Status: where this season ranks among the all-time top 25 ──────────
// (football's version of basketball's GOAT screen; the lists are data/nfl-goat.js)
const GOAT_POS = { qb: 'QBs', rb: 'Running Backs', wr: 'Wide Receivers', te: 'Tight Ends', db: 'Defensive Backs', dl: 'Defensive Linemen', lb: 'Linebackers', ol: 'Offensive Linemen' }
const GOAT_N = 25

// Your season's spot: OVR sets it (90 just makes the list, 99 is near the top), a
// monster stat line moves it up a few, the season award and a ring more. The top
// spots need the hardware: no ring, no top 4; #1 takes a 99, the award and a ring.
function nflGoatRank(kind, result, wonAward) {
  const { ovr = 0, sbResult } = result
  if (ovr < 90) return null
  const ring = !!sbResult?.won
  const r = result
  const pts = (v, steps) => steps.filter(x => (v ?? 0) >= x).length
  const stat = kind === 'qb' ? pts(r.seasonPassYds, [4500, 5200]) + pts(r.seasonTDs, [38, 48])
    : kind === 'rb' ? pts(r.seasonRushYds, [1600, 2000]) + pts((r.seasonRushTDs ?? 0) + (r.seasonRecTDs ?? 0), [16, 22]) + pts(r.seasonRecYds, [600])
    : kind === 'wr' ? pts(r.seasonRecYds, [1500, 1800]) + pts(r.seasonRecTDs, [13, 17])
    : kind === 'te' ? pts(r.seasonRecYds, [1200, 1500]) + pts(r.seasonRecTDs, [11, 15])
    : kind === 'lb' ? pts(r.seasonTackles, [150, 170]) + pts(r.seasonINTs, [4, 6]) + pts(r.seasonSacks, [6]) + pts(r.seasonFF, [4])
    : kind === 'k' ? pts(r.seasonFGPct, [92, 96]) + pts(r.season50M, [8, 12]) + pts(r.seasonGW, [3])
    : kind === 'ol' ? pts(4 - (r.seasonSacksAllowed ?? 9), [2, 4]) + pts(r.seasonGrade, [88, 92]) + pts(r.seasonPancakes, [55])
    : kind === 'dl' ? pts(r.seasonSacks, r.spot === 'DT' ? [12, 16] : [16, 20]) + pts(r.seasonTFL, [22, 28]) + pts(r.seasonFF, [5])
    : pts(r.seasonINTs, [7, 10]) + pts(r.seasonPickSixes, [2]) + pts(r.seasonPBUs, [18])
  let rank = Math.round(GOAT_N - ((ovr - 90) / 9) * 21) - Math.min(4, stat) - (wonAward ? 3 : 0) - (ring ? 2 : 0)
  if (!ring) rank = Math.max(rank, 5)
  if (rank <= 3 && !(ring && ovr >= 97)) rank = 4
  if (rank <= 2 && !(ring && wonAward && ovr >= 97)) rank = 3
  if (rank <= 1 && !(ring && wonAward && ovr >= 99)) rank = 2
  rank = Math.max(1, rank)
  return rank <= GOAT_N ? rank : null
}

const NFL_TEAM = Object.fromEntries(TEAMS.map(t => [t.short, t]))

function NflGoatCard({ rank, entry, isPlayer, team, userName }) {
  const short = isPlayer ? team?.short : entry?.team
  const color = isPlayer ? team?.color : NFL_TEAM[short]?.color
  const photo = !isPlayer && entry ? nflHeadshot(entry.headshot ?? HEADSHOTS[entry.name]) : null
  const isGoat = !isPlayer && rank === 1
  return (
    <div className={`goat-card${isPlayer ? ' goat-card--you' : ''}${isGoat ? ' goat-card--rank1' : ''}`} style={{ '--accent': isPlayer ? '#e8a820' : (color ?? 'rgba(255,255,255,0.15)') }}>
      {isGoat && <span className="goat-card-watermark" aria-hidden="true">G.O.A.T.</span>}
      <span className="goat-card-rank">{rank}</span>
      <QBAvatar photo={photo} team={short} color={color} size={isPlayer ? 56 : 44} />
      <div className="goat-card-info">
        <span className="goat-card-name">{isPlayer ? userName : (entry?.name ?? '—')}</span>
        {short && <span className="goat-card-team">{short}{!isPlayer && entry?.years ? ` · ${entry.years}` : ''}</span>}
      </div>
    </div>
  )
}

function GoatRows({ withYou, rank, byRank, team, userName, listIn, listRef }) {
  // with you in the list, everyone from your spot down moves down one
  const entryAt = r => (r < rank ? byRank[r] : r === rank ? null : byRank[r - 1] ?? null)
  return (
    <div ref={listRef} className={`goat-full-list${listIn ? ' goat-list-in' : ''}`}>
      {Array.from({ length: GOAT_N }, (_, i) => GOAT_N - i).map(r => (
        <Fragment key={r}>
          <NflGoatCard rank={r} entry={withYou ? entryAt(r) : byRank[r]} isPlayer={withYou && r === rank} team={team} userName={userName} />
          {(r === 21 || r === 11) && <div id={`ramp-cntr1-nflgoat-${r}`} className="ad-cntr1-mobile" />}
        </Fragment>
      ))}
    </div>
  )
}

function ScreenGOAT({ kind, result, wonAward, onNext, adsDisabled = false, userName = 'Guest' }) {
  const byRank = useMemo(() => Object.fromEntries((NFL_GOAT[kind] ?? []).map(g => [g.rank, g])), [kind])
  const playerRank = useMemo(() => nflGoatRank(kind, result, wonAward), [kind, result, wonAward])
  const qualified = playerRank != null
  const team = result.team
  const [phase, setPhase] = useState('checking')
  const [tick, setTick] = useState(GOAT_N + 1)
  const [listIn, setListIn] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => { setPhase(qualified ? 'ticker' : 'miss'); if (!qualified) setListIn(true) }, 2000)
    return () => clearTimeout(t)
  }, [qualified])
  // the countdown from #25 to your spot (it never shows who's at your spot)
  useEffect(() => {
    if (phase !== 'ticker') return
    if (tick <= playerRank) {
      const t = setTimeout(() => {
        setPhase('revealed')
        setTimeout(() => { setListIn(true); setTimeout(() => listRef.current?.querySelector('.goat-card--you')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500) }, 500)
      }, 1000)
      return () => clearTimeout(t)
    }
    const dist = tick - playerRank
    const t = setTimeout(() => setTick(r => r - 1), dist > 10 ? 80 : dist > 4 ? 160 : 280)
    return () => clearTimeout(t)
  }, [phase, tick, playerRank])
  // phones: a banner every ten rows (after 21 and 11), like basketball's list
  useEffect(() => {
    if (!listIn || adsDisabled || window.innerWidth > 768) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-nflgoat-21' }, { type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-nflgoat-11' }])
  }, [listIn]) // eslint-disable-line

  const tickEntry = tick > GOAT_N ? null : tick > playerRank ? byRank[tick - 1] : byRank[tick]
  const rowProps = { rank: playerRank, byRank, team, userName, listIn, listRef }

  return (
    <div className="simp-screen goat-screen">
      <div className="goat-screen-title">GOAT STATUS</div>
      <div className="goat-page-title">Top 25 {GOAT_POS[kind]}</div>
      <div className="goat-eyebrow">OF ALL TIME</div>
      {phase === 'checking' && (
        <div className="goat-checking"><div className="goat-check-ring" /><div className="goat-check-lbl">Checking the resume…</div></div>
      )}
      {phase === 'ticker' && (
        <div className="goat-ticker" onClick={() => { setPhase('revealed'); setListIn(true) }}>
          <div className="goat-ticker-rank">#{Math.min(tick, GOAT_N)}</div>
          <QBAvatar photo={tickEntry ? nflHeadshot(tickEntry.headshot ?? HEADSHOTS[tickEntry.name]) : null} team={tickEntry?.team} color={NFL_TEAM[tickEntry?.team]?.color} size={120} />
          <div className="goat-ticker-name">{tickEntry?.name ?? '…'}</div>
          <div className="goat-ticker-team">{tickEntry?.team ?? ''}</div>
        </div>
      )}
      {phase === 'miss' && <>
        <div className="goat-miss-card"><div className="goat-miss-title">Missed the Cut</div><div className="goat-miss-ovr">OVR {result.ovr}</div></div>
        <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
        <GoatRows withYou={false} {...rowProps} />
        <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>
      </>}
      {phase === 'revealed' && <>
        <div className="goat-reveal-banner"><div className="goat-reveal-you">{userName} is ranked</div><div className="goat-reveal-rank">#{playerRank}</div></div>
        <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
        <GoatRows withYou {...rowProps} />
        <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>
      </>}
    </div>
  )
}

function ScreenFinal({ result, build, types, onReset, onBack, adsDisabled = false, mvpWon = false, protWon = false, isRB = false, isWR = false, isTE = false, isDB = false, isDL = false, isLB = false, isOL = false, isK = false, userName = 'Guest', isSalaryMode = false }) {
  const { ovr, wins, losses, playoffs, sbResult, bestGame } = result

  // QB stats
  const { seasonPassYds, seasonTDs, seasonINTs: qbSeasonINTs, seasonRushYds: qbRushYds, seasonRushTDs, seasonSacks, seasonCompPct, seasonRating } = result

  // RB / WR stats
  const { seasonRushYds: rbRushYds, seasonRushTDs: rbRushTDs, seasonYPC, seasonFumbles,
          seasonRecYds, seasonRecTDs, seasonRecs, seasonLong, seasonCarries, hundredYardGames, seasonYPR,
          seasonTargets, catchRate } = result

  // DB stats
  const { seasonINTs: dbSeasonINTs, seasonPBUs, seasonTackles, seasonTFL, seasonPickSixes } = result

  // OL stats
  const { seasonPancakes, seasonPressures } = result

  const champion = sbResult?.won
  const [show, setShow] = useState(false)

  // the season as a share card (Share Season)
  const kind = isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'
  const shareCard = useMemo(() => {
    if (!build || !types) return null
    const meta = isK ? K_ATTR : isOL ? OL_ATTR : isDL ? DL_ATTR : isLB ? LB_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR
    const archFn = { k: getArchetypeK, ol: getArchetypeOL, db: getArchetypeDB, dl: getArchetypeDL, lb: getArchetypeLB, te: getArchetypeTE, wr: getArchetypeWR, rb: getArchetypeRB, qb: getArchetype }[kind]
    let arch = null
    try { arch = archFn(ovr, build, types) } catch {}
    return nflSeasonCard({
      result, pos: kind, name: userName, arch, salary: isSalaryMode,
      award: mvpWon || !!result.award?.userWins, protector: protWon,
      rows: buildRows(build, types, meta, isSalaryMode && kind === 'qb'),
    })
  }, [result, build, types, kind, ovr, userName, isSalaryMode, mvpWon, protWon])

  const team = result.team
  const monoTeamBuild = team
    ? Object.fromEntries(
        Object.entries(build || {}).map(([k, v]) => [
          k,
          v ? { ...v, teamColor: team.color, teamColor2: team.color2, team: team.short } : v,
        ])
      )
    : build

  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t) }, [])

  useEffect(() => {
    if (adsDisabled) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-sim' }])
  }, [])

  // QB count-ups
  const yds     = useCountUp(seasonPassYds, 1200, show && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL && !isK)
  const tds     = useCountUp(seasonTDs, 900, show && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL)
  const ints    = useCountUp(qbSeasonINTs, 900, show && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL)
  const rushYds = useCountUp(qbRushYds, 1000, show && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL)
  const sacks   = useCountUp(seasonSacks, 900, show && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL)

  // OL count-ups
  // K count-ups
  const kPointsAnim = useCountUp(result.seasonPoints, 1000, show && isK)

  const olPancakesAnim  = useCountUp(seasonPancakes, 1000, show && isOL)
  const olPressuresAnim = useCountUp(seasonPressures, 900, show && isOL)

  // DB count-ups
  const dbINTsAnim     = useCountUp(dbSeasonINTs, 900, show && isDB)
  const dbPBUsAnim     = useCountUp(seasonPBUs, 900, show && isDB)
  const dbTacklesAnim  = useCountUp(seasonTackles, 1000, show && isDB)

  // LB count-ups
  const lbTacklesAnim = useCountUp(seasonTackles, 1000, show && isLB)
  const lbSacksAnim   = useCountUp(seasonSacks, 900, show && isLB)
  const lbINTsAnim    = useCountUp(result.seasonINTs ?? 0, 900, show && isLB)

  // DL count-ups
  const dlSacksAnim   = useCountUp(seasonSacks, 900, show && isDL)
  const dlTFLAnim     = useCountUp(seasonTFL, 900, show && isDL)
  const dlTacklesAnim = useCountUp(seasonTackles, 1000, show && isDL)

  // RB count-ups
  const rbRushYdsAnim = useCountUp(rbRushYds, 1200, show && isRB)
  const rbRecYdsAnim  = useCountUp(seasonRecYds, 1000, show && isRB)

  // WR/TE count-ups
  const wrRecYdsAnim = useCountUp(seasonRecYds, 1200, show && (isWR || isTE))

  return (
    <div className="simp-screen">
      {APP_SIM && <SeasonRewards result={result} />}
      {APP_SIM && result.story && <SeasonStory story={result.story} pos={isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'} sport="nfl" name={userName} />}
      <div className={`simp-final-banner ${champion ? 'sfb-champ' : playoffs ? 'sfb-elim' : 'sfb-miss'}`}>
        {champion && <img src="/trophy.webp" alt="Super Bowl Trophy" className="sfb-trophy" />}
        <div className="sfb-outcome">
          {champion ? 'Super Bowl Champions' : playoffs ? (sbResult?.round === 'Super Bowl' ? 'Lost Super Bowl' : `Eliminated — ${sbResult?.round}`) : 'Missed the Playoffs'}
        </div>
        <div className="sfb-sub">{wins}–{losses} Season · OVR {ovr}</div>
      </div>
      <ShareSeasonButton card={shareCard} />
      {playoffs && <PlayoffLog rounds={result.playoffRounds} />}

      {champion && (
        <div className="simp-sb-box">
          <div className="simp-section-lbl">Super Bowl Performance</div>
          <div className="simp-totals">
            {isK ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.fgm ?? 0}/{sbResult.fga ?? 0}</div>
                  <div className="simp-total-lbl">Field Goals</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.long || '–'}</div>
                  <div className="simp-total-lbl">Longest</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.pts ?? 0}</div>
                  <div className="simp-total-lbl">{sbResult.gw ? 'Points · Kicked the Winner' : 'Points'}</div>
                </div>
              </>
            ) : isOL ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.sacks ?? 0}</div>
                  <div className="simp-total-lbl">Sacks Allowed</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.pressures ?? 0}</div>
                  <div className="simp-total-lbl">Pressures Allowed</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.pancakes ?? 0}</div>
                  <div className="simp-total-lbl">Pancakes</div>
                </div>
              </>
            ) : isLB ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.tackles ?? 0}</div>
                  <div className="simp-total-lbl">Tackles</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.sacks ?? 0}</div>
                  <div className="simp-total-lbl">Sacks</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.ints ?? 0}</div>
                  <div className="simp-total-lbl">INTs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.pds ?? 0}</div>
                  <div className="simp-total-lbl">PD</div>
                </div>
              </>
            ) : isDL ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.sacks ?? 0}</div>
                  <div className="simp-total-lbl">Sacks</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.tfl ?? 0}</div>
                  <div className="simp-total-lbl">TFL</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.tackles ?? 0}</div>
                  <div className="simp-total-lbl">Tackles</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.qbHits ?? 0}</div>
                  <div className="simp-total-lbl">QB Hits</div>
                </div>
              </>
            ) : isDB ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.ints ?? 0}</div>
                  <div className="simp-total-lbl">INTs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.pbus ?? 0}</div>
                  <div className="simp-total-lbl">PBUs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.tackles ?? 0}</div>
                  <div className="simp-total-lbl">Tackles</div>
                </div>
              </>
            ) : isRB ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.rushYds ?? 0}</div>
                  <div className="simp-total-lbl">Rush Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.rushTDs ?? 0}</div>
                  <div className="simp-total-lbl">Rush TDs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.recYds ?? 0}</div>
                  <div className="simp-total-lbl">Rec Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.recTDs ?? 0}</div>
                  <div className="simp-total-lbl">Rec TDs</div>
                </div>
              </>
            ) : (isWR || isTE) ? (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.rec ?? 0}</div>
                  <div className="simp-total-lbl">Rec</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.recYds ?? 0}</div>
                  <div className="simp-total-lbl">Rec Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.recTDs ?? 0}</div>
                  <div className="simp-total-lbl">Rec TDs</div>
                </div>
              </>
            ) : (
              <>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.passYds}</div>
                  <div className="simp-total-lbl">Pass Yds</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.tds}</div>
                  <div className="simp-total-lbl">TDs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.ints ?? 0}</div>
                  <div className="simp-total-lbl">INTs</div>
                </div>
                <div className="simp-total-cell">
                  <div className="simp-total-val">{sbResult.rating}</div>
                  <div className="simp-total-lbl">Rating</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {team && build && (
        (isWR || isTE) ? (
          <div className="simp-team-model simp-team-model--rb">
            <div className="simp-team-model-glow" />
            <img src="/wr-silhouette.png" alt="" className="simp-sil-ghost" draggable={false} style={{ filter: 'brightness(0.55)' }} />
            <WRFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isK ? (
          <div className="simp-team-model" style={K_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={K_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <KFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isOL ? (
          <div className="simp-team-model" style={OL_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={OL_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <OLFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isLB ? (
          <div className="simp-team-model" style={LB_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src={LB_SILHOUETTE} alt="" className="simp-sil-ghost" draggable={false} />
            <LBFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isDL ? (
          <div className="simp-team-model" style={DL_MODEL_STYLE}>
            <div className="simp-team-model-glow" />
            <img src="/dl-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
            <DLFigureOverlay build={monoTeamBuild} />
          </div>
        ) : isDB ? (
          <div className="simp-team-model simp-team-model--db">
            <div className="simp-team-model-glow" />
            <img src="/db-silhouette.png" alt="" className="simp-sil-ghost" draggable={false} style={{ filter: 'brightness(0.35) drop-shadow(0 0 3px rgba(255,255,255,0.35))' }} />
            <DBFigureOverlay build={monoTeamBuild} />
          </div>
        ) : (
          <div className={`simp-team-model${isRB ? ' simp-team-model--rb' : ''}`}>
            <div className="simp-team-model-glow" />
            {isRB ? (
              <>
                <img src="/rb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
                <RBFigureOverlay build={monoTeamBuild} />
              </>
            ) : (
              <>
                <img src="/qb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
                <QBFigureOverlay build={monoTeamBuild} className="player-qbfig" />
              </>
            )}
          </div>
        )
      )}

      <div className="simp-stat-section">
        <div className="simp-eyebrow">Production</div>

        <StatLineTable
          result={result} build={build} ready={show} userName={userName} kind={isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'}
          values={
            isK ? { pts: kPointsAnim }
            : isOL ? { pnk: olPancakesAnim, prs: olPressuresAnim }
            : isLB ? { tkl: lbTacklesAnim, sck: lbSacksAnim, int: lbINTsAnim }
            : isDL ? { sck: dlSacksAnim, tfl: dlTFLAnim, tkl: dlTacklesAnim }
            : isDB ? { tkl: dbTacklesAnim, pd: dbPBUsAnim, int: dbINTsAnim }
            : isRB ? { rushYds: rbRushYdsAnim, recYds: rbRecYdsAnim }
            : (isWR || isTE) ? { recYds: wrRecYdsAnim }
            : { yds, td: tds, int: ints, rushYds, sck: sacks }
          }
        />

        {isOL && protWon && (
          <div className="sfb-mvp-row">
            <img src="/mvp.png" alt="Trophy" className="sfb-mvp-row-img" />
            <div className="sfb-mvp-row-text">
              <div className="sfb-mvp-row-title">Protector of the Year</div>
              <div className="sfb-mvp-row-sub">NFL Award Winner</div>
            </div>
          </div>
        )}
        {mvpWon && (
          <div className="sfb-mvp-row">
            <img src="/mvp.png" alt="MVP Trophy" className="sfb-mvp-row-img" />
            <div className="sfb-mvp-row-text">
              <div className="sfb-mvp-row-title">{(isOL || isK) ? 'First-Team All-Pro' : (isDB || isDL || isLB) ? 'Defensive Player of the Year' : (isWR || isTE || isRB) ? 'Offensive Player of the Year' : 'Regular Season MVP'}</div>
              <div className="sfb-mvp-row-sub">{(isOL || isK) ? 'AP All-Pro Selection' : 'NFL Award Winner'}</div>
            </div>
          </div>
        )}
      </div>

      {build && types && (
        <div className="simp-stat-section">
          <div className="simp-stat-group-lbl"><NameTag name={userName} self />'s Build</div>
          <div className="simp-attr-table simp-attr-table-sm">
            {buildRows(build, types, isK ? K_ATTR : isOL ? OL_ATTR : isDL ? DL_ATTR : isLB ? LB_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR, isSalaryMode && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL).map(({ key, label, data, val }) => {
              return (
                <div key={key} className="simp-attr-row simp-row-visible">
                  <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={36} />
                  <div className="simp-attr-info">
                    <span className="simp-attr-name">{label}</span>
                    <span className="simp-attr-qb">{data.qbFull}</span>
                  </div>
                  <span className="simp-grade-circle" style={{ background: gradeColor(val), color: '#07120a' }}>
                    {valToGrade(val)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {bestGame && isK && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.fgm}/{bestGame.fga} FG{bestGame.long ? ` · long ${bestGame.long}` : ''} · {bestGame.pts} pts{bestGame.gw ? ' · kicked the game-winner' : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && !isRB && !isWR && !isTE && !isDB && !isDL && !isLB && !isOL && !isK && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">{bestGame.passYds} yds · {bestGame.tds} TD · {bestGame.ints} INT · {bestGame.rating} RTG</span>
          </div>
        </div>
      )}

      {bestGame && isOL && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.sacks} sack{bestGame.sacks !== 1 ? 's' : ''} allowed · {bestGame.pressures} pressure{bestGame.pressures !== 1 ? 's' : ''} · {bestGame.pancakes} pancake{bestGame.pancakes !== 1 ? 's' : ''}
              {bestGame.penalties > 0 ? ` · ${bestGame.penalties} PEN` : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && isLB && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.tackles} tkl · {bestGame.tfl} TFL
              {bestGame.sacks > 0 ? ` · ${bestGame.sacks} sack${bestGame.sacks !== 1 ? 's' : ''}` : ''}
              {bestGame.ints > 0 ? ` · ${bestGame.ints} INT${bestGame.pickSixes > 0 ? ` (${bestGame.pickSixes} TD)` : ''}` : ''}
              {bestGame.ff > 0 ? ` · ${bestGame.ff} FF` : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && isDL && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.sacks} sack{bestGame.sacks !== 1 ? 's' : ''} · {bestGame.tfl} TFL · {bestGame.tackles} tkl
              {bestGame.ff > 0 ? ` · ${bestGame.ff} FF` : ''}
              {bestGame.safeties > 0 ? ` · ${bestGame.safeties} SFTY` : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && isDB && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.ints > 0 ? `${bestGame.ints} INT${bestGame.pickSixes > 0 ? ` (${bestGame.pickSixes} TD)` : ''} · ` : ''}
              {bestGame.pbus} PBU · {bestGame.tackles} tkl{bestGame.tfl > 0 ? ` · ${bestGame.tfl} TFL` : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && isRB && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.rushYds} rush yds · {bestGame.rushTDs + bestGame.recTDs} TD
              {bestGame.recYds > 0 ? ` · ${bestGame.recYds} rec yds` : ''}
              {bestGame.fumbles > 0 ? ' · 1 FUM' : ''}
            </span>
          </div>
        </div>
      )}

      {bestGame && (isWR || isTE) && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">
              {bestGame.rec} rec · {bestGame.recYds} yds{bestGame.recTDs > 0 ? ` · ${bestGame.recTDs} TD` : ''}
            </span>
          </div>
        </div>
      )}


      <div id="ramp-cntr1-sim" className="ad-cntr1-mobile" />

      <div className="simp-final-actions">
        {isSalaryMode
          ? <button className="simp-cta" onClick={onBack}>← Back to Salary</button>
          : <>
              <button className="simp-cta" onClick={onReset}>New Build</button>
              <button className="simp-ghost" onClick={onBack}>Back to Build</button>
            </>}
      </div>

      {/* the 32-0 cross-promo stays on the website, not in the app */}
      {!IS_APP && <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>
          If you are enjoying Build-A-Player, check out my college basketball game —{' '}
          <a href="https://32-0game.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>32-0game.com</a>
        </span>
        <a href="https://32-0game.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <img src="/32-0logocutout.png" alt="32-0" style={{ height: '32px', width: 'auto', background: 'white', borderRadius: '5px', padding: '2px 6px', display: 'block' }} />
        </a>
      </div>}
    </div>
  )
}

// ── Progress Dots ─────────────────────────────────────────────────────────────

function ProgressDots({ screen, total }) {
  return (
    <div className="simp-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`simp-dot ${i === screen ? 'simp-dot-active' : i < screen ? 'simp-dot-done' : ''}`} />
      ))}
    </div>
  )
}

// ── SimPage ───────────────────────────────────────────────────────────────────

export default function SimPage({ result: baseResult, build, types = TYPES, onBack, onReset, replay = false, adsDisabled = false, isRB = false, isWR = false, isTE = false, isDB = false, isDL = false, isLB = false, isOL = false, isK = false, onMVPWon, simFn = null, onFinal = null, pool = null, userName = 'Guest', isSalaryMode = false }) {
  // a replay opens on the final report (after the GOAT screen; OL has none), and so does coming back
  // to a season that was already played and booked (it has its story): never a second run at it
  const [screen, setScreen] = useState(replay || baseResult.story ? 4 : 0)
  useRailOn(screen)   // each screen of the season brings the bottom rail back
  const tapGuard = useTapGuard()
  const [mvpResult, setMvpResult] = useState(null)
  const [mvpWon, setMvpWon] = useState(false)
  const [protWon, setProtWon] = useState(false)   // a lineman's Protector of the Year (his All-Pro is mvpWon)
  const [mvpContinuation, setMvpContinuation] = useState(null)
  // App: the season is steered by a director; `result` is the live version of it
  const [live, setLive] = useState(baseResult)
  const result = live
  const position = isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'
  const attrMap = isK ? K_ATTR : isOL ? OL_ATTR : isDL ? DL_ATTR : isLB ? LB_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR
  const director = useMemo(() => (APP_SIM && (simFn || isSalaryMode) && !replay && !baseResult.story && baseResult.games?.length)
    ? createDirector({ sport: 'nfl', pos: position, build, team: baseResult.team, simFn: simFn ?? (() => baseResult), locked: isSalaryMode, base: baseResult, name: userName, attrMap, types, ...(isK ? { injuryOdds: { season: 0, playoffs: 0 } } : {}) })   // (a kicker is never hurt)
    : null, []) // eslint-disable-line
  const handleFinal = final => { setLive(final); onFinal?.(final) }
  // leaving mid-season still books the season (`leaving`: booked on the way out, so it
  // doesn't send you back to this page, onto its final report, from wherever you went)
  // (useOnLeave: only a real leave, not React's development double mount, which finalized the director before a game)
  useOnLeave(() => { if (director && !director.finalized) onFinal?.(director.finalize(), { leaving: true }) })
  const isAllTime = !!result.team?.isAllTime
  const reachesSB = result.playoffRounds?.some(r => r.round === 'Super Bowl') ?? false

  const advancePage = () => {
    tapGuard.mark()
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    setScreen(s => Math.min(s + 1, screens.length - 1))   // never past the Final Report (a blank page with no way back)
  }

  const triggerMVP = (continuation = null) => {
    tapGuard.mark()
    // App decides the award when the season is simulated (so it saves with the
    // season and counts toward lifetime awards there); this only reveals it.
    const r = result.award ?? (isK
      ? calcKAllProResult(result, isAllTime, result.team?.short)
      : isOL
      ? calcOLAllProResult(result, isAllTime, result.team?.short)
      : isDL
      ? calcDLDpoyResult(result, isAllTime, result.team?.short)
      : isLB
      ? calcLBDpoyResult(result, isAllTime, result.team?.short)
      : isDB
      ? calcDBDpoyResult(result, isAllTime, result.team?.short)
      : isTE
        ? calcTEOPOYResult(result, isAllTime, result.team?.short)
        : isWR
          ? calcWROPOYResult(result, isAllTime, result.team?.short)
          : isRB
            ? calcOPOYResult(result, isAllTime, result.team?.short)
            : calcMVPResult(result, isAllTime, result.team?.short))
    setMvpResult(r)
    if (r.protector?.userWins) setProtWon(true)
    if (r.userWins) {
      setMvpWon(true)
      onMVPWon?.(isAllTime, (isOL || isK) ? 'allpro' : (isDB || isDL || isLB) ? 'dpoy' : (isRB || isWR || isTE) ? 'opoy' : 'mvp')
    }
    if (continuation) setMvpContinuation(() => continuation)
  }

  const next = () => {
    // SB players get award pre-SB via onPreSuperBowl — skip here
    if (screen === 2 && !mvpResult && !reachesSB) {
      triggerMVP()
      return
    }
    advancePage()
  }

  const handleMVPDismiss = () => {
    setMvpResult(null)
    if (mvpContinuation) {
      mvpContinuation()
      setMvpContinuation(null)
    } else {
      advancePage()
    }
  }

  const handlePreSuperBowl = (continuation) => {
    triggerMVP(continuation)
  }

  const handleReset = () => { setScreen(0); onReset() }
  const handleBack  = () => { setScreen(0); onBack()  }

  const screens = [
    <ScreenBuild    key="build"    result={result} build={build} types={types} onNext={next} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} isDL={isDL} isLB={isLB} isOL={isOL} isK={isK} isSalaryMode={isSalaryMode} />,
    <ScreenSeason   key="season"   result={result} onNext={next} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} isDL={isDL} isLB={isLB} isOL={isOL} isK={isK} adsDisabled={adsDisabled} build={build} types={types} director={director} onFinal={handleFinal} pool={pool} userName={userName} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={next} onPreSuperBowl={handlePreSuperBowl} adsDisabled={adsDisabled} nextLabel="GOAT Status" />,
    // where the season ranks among the all-time top 25 at the position (no OL list)
    ...([<ScreenGOAT key="goat" kind={isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'} result={result} wonAward={isOL ? protWon : mvpWon} onNext={next} adsDisabled={adsDisabled} userName={userName} />]),
    <ScreenFinal    key="final"    result={result} build={build} types={types} onReset={handleReset} onBack={handleBack} adsDisabled={adsDisabled} mvpWon={mvpWon} protWon={protWon || !!result.award?.protector?.userWins} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} isDL={isDL} isLB={isLB} isOL={isOL} isK={isK} userName={userName} isSalaryMode={isSalaryMode} />,
  ]

  const team = result.team
  const teamStyle = team
    ? { '--team-color': team.color, '--team-color2': team.color2 }
    : undefined

  return (
    <div className="simp-page" style={teamStyle} onClickCapture={tapGuard.onClickCapture}>
      <div className="simp-col">
        <div className="simp-top-bar">
          {/* a steered season can't be backed out of: going back would replay the year and its decisions */}
          {screen > 0 && screen < screens.length - 1 && !(director && screen <= 2) && (
            <button className="simp-back-btn" onClick={() => setScreen(s => s - 1)}>← Back</button>
          )}
          <ProgressDots screen={screen} total={screens.length} />
        </div>

        {/* the moments switch sits above the team card, not on it */}
        {team && director && !isSalaryMode && <div className="sts-moments-row"><MomentsToggle /></div>}
        {team && (
          <div className="simp-team-strip">
            <div className="sts-top-row">
              <img src={team.logo} alt={team.short} className="sts-logo" />
              <div className="sts-info">
                {team.isAllTime && <span className="sts-alltime-badge">★ All-Time</span>}
                <div className="sts-name-wrap">
                  <span className="sts-city">{team.name.split(' ').slice(0, -1).join(' ')}</span>
                  <span className="sts-nickname">{team.name.split(' ').slice(-1)[0]}</span>
                </div>
              </div>
              {(team.off != null || team.def != null) && (
                <div className="sts-grades">
                  {team.off != null && (
                    <div className="sts-grade-item">
                      <span className="sts-grade-key">OFF</span>
                      <div className="sts-grade-track">
                        <div className="sts-grade-fill" style={{ width: `${team.off * 10}%` }} />
                      </div>
                      <span className="sts-grade-badge">{offDefGrade(team.off)}</span>
                    </div>
                  )}
                  {team.def != null && (
                    <div className="sts-grade-item">
                      <span className="sts-grade-key">DEF</span>
                      <div className="sts-grade-track">
                        <div className="sts-grade-fill" style={{ width: `${team.def * 10}%` }} />
                      </div>
                      <span className="sts-grade-badge">{offDefGrade(team.def)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isWR && team && build && (
          <WRDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {isTE && team && build && (
          <TEDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {isRB && team && build && (
          <RBDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {isDB && team && build && (
          <DBDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {isLB && team && build && (
          <LBDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {isDL && team && build && (
          <DLDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}
        {/* (no depth chart for a kicker: a team carries one, and he is always the starter) */}
        {isOL && team && build && (
          <OLDepthChart team={team} build={build} types={types} isAllTime={isAllTime} userName={userName} />
        )}

        {screens[screen]}
        <SiteFooter sport="nfl" />
      </div>

      {mvpResult && (
        <MVPModal
          nextLabel="Continue to GOAT Status"
          result={result}
          mvpResult={mvpResult}
          onDismiss={handleMVPDismiss}
          toSuperBowl={!!mvpContinuation}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB} isDL={isDL} isLB={isLB}
          isOL={isOL} isK={isK}
          userPhoto={isOL ? (build?.size?.photo ?? null) : isK ? (build?.power?.photo ?? null) : null}
          userName={userName}
        />
      )}
    </div>
  )
}
