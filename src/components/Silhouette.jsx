import { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react'
import { ATTR, TYPES, CATEGORIES, QB_PHYSICALS } from '../data/qbs'
import { RB_CATEGORIES, RB_PHYSICALS } from '../data/rbs'
import { WR_CATEGORIES, WR_PHYSICALS } from '../data/wrs'
import { TE_PHYSICALS } from '../data/tes'
import { TE_LEGENDS } from '../data/te-legends'
import { DBS } from '../data/dbs'
import { DLS } from '../data/dls'
import { DL_LEGENDS } from '../data/dl-legends'
import { LBS, LB_SILHOUETTE } from '../data/lbs'
import { OL_SILHOUETTE } from '../data/ols'
import { KS } from '../data/ks'
import { K_LEGENDS } from '../data/k-legends'
import { kAsQB } from '../lib/kFigure'
import { LB_LEGENDS } from '../data/lb-legends'
import { DB_LEGENDS } from '../data/db-legends'
import { OL_PHYSICALS } from '../data/ols'
import { QB_LEGEND_PHYSICALS } from '../data/qb-legends'
import { RB_LEGEND_PHYSICALS } from '../data/rb-legends'
import { WR_LEGEND_PHYSICALS } from '../data/wr-legends'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
const ALL_QB_PHYS = { ...QB_LEGEND_PHYSICALS, ...QB_PHYSICALS }
const ALL_RB_PHYS = { ...RB_LEGEND_PHYSICALS, ...RB_PHYSICALS }
const ALL_WR_PHYS = { ...WR_LEGEND_PHYSICALS, ...WR_PHYSICALS }
import QBAvatar from './QBAvatar'
import { IS_APP, APP_LOOK } from '../lib/platform'
import AppSandbox from './app/AppSandbox'

function fmtHeight(in_) { return `${Math.floor(in_ / 12)}'${in_ % 12}"` }
function lightenHex(hex, amt) {
  if (!hex || !hex.startsWith('#')) return hex
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt)
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt)
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt)
  return `rgb(${r},${g},${b})`
}
import QBFigureOverlay from './QBFigureOverlay'
import RBFigureOverlay from './RBFigureOverlay'
import WRFigureOverlay from './WRFigureOverlay'
import DBFigureOverlay from './DBFigureOverlay'
import OLFigureOverlay from './OLFigureOverlay'
import DLFigureOverlay from './DLFigureOverlay'
import LBFigureOverlay from './LBFigureOverlay'
import BucketFigureOverlay from './BucketFigureOverlay'
import { SOCCER_SILHOUETTE, SOCCER_AS_BUCKET, soccerAsBucketBuild } from '../lib/soccerUi'
import { BASEBALL_SILHOUETTE, BASEBALL_AS_BUCKET } from '../lib/baseballUi'

const DB_PHYS = Object.fromEntries([...DBS, ...DB_LEGENDS].map(d => [d.name, { height: d.height, weight: d.weight }]))
const DL_PHYS = Object.fromEntries([...DLS, ...DL_LEGENDS].map(d => [d.name, { height: d.height, weight: d.weight }]))
const LB_PHYS = Object.fromEntries([...LBS, ...LB_LEGENDS].map(d => [d.name, { height: d.height, weight: d.weight }]))
const K_PHYS = Object.fromEntries([...KS, ...K_LEGENDS].map(d => [d.name, { height: d.height, weight: d.weight }]))
const ALL_TE_PHYS = { ...Object.fromEntries(TE_LEGENDS.map(t => [t.name, { height: t.height, weight: t.weight }])), ...TE_PHYSICALS }

// Figure coordinate space (matches QB silhouette dimensions)
const FIG_W = 622
const FIG_H = 844
const CARD_W = 211  // must match .cz-card width in CSS

// RB silhouette coordinate space
const RB_FIG_W = 574
const RB_FIG_H = 865

// CSS scale applied to the RB figure image + overlay
const RB_FIGURE_SCALE = 0.90
const WR_FIGURE_SCALE = 0.975
const WR_FIGURE_SCALE_MOBILE = 1.005
const BUCKET_FIGURE_SCALE = 1.10
// App, phone, basketball: the T-pose fills the width and the cards stack down
// both sides below the arms (index.css / app-game.css size the cards to match)
const APP_BKT = { scale: 0.86, cardIn: 4, cardW: 100, top: 0.36, bottom: 0.9, stub: 8, noDotRow: 0.13 }   // sized like the football figure's; Size (no dot) sits top right, above the hand
const DB_FIGURE_SCALE = 0.86

// QB anchor positions
const ZONES = [
  { type: 'vision',          ax: 375, ay:  75, side: 'right', cy: 0.09  },
  { type: 'processing',      ax: 275, ay:  42, side: 'left',  cy: 0.14  },
  { type: 'leadership',      ax: 330, ay: 120, side: 'right', cy: 0.277 },
  { type: 'arm',             ax: 171, ay: 175, side: 'left',  cy: 0.504 },
  { type: 'playmaking',      ax: 350, ay: 240, side: 'right', cy: 0.464 },
  { type: 'accuracy',        ax: 110, ay: 216, side: 'left',  cy: 0.322 },
  { type: 'size',            ax: 380, ay: 250, side: 'right', cy: 0.651 },
  { type: 'legs',            ax: 207, ay: 525, side: 'left',  cy: 0.686 },
  { type: 'pocket-presence', ax: 465, ay: 520, side: 'right', cy: 0.838 },
]

// RB anchor positions — calibrated to the running pose (head upper-right,
// stiff arm / ball arm right, free arm left, lead leg lower-right)
// cy values evenly spaced (0.06→0.94, step 0.11) alternating sides
const RB_ZONES = [
  { type: 'vision',      ax: 273, ay: 100, side: 'right', cy: 0.06 },  // helmet
  { type: 'burst',       ax: 144, ay: 620, side: 'left',  cy: 0.83 },  // left foot
  { type: 'hands',       ax: 175, ay: 473, side: 'left',  cy: 0.61 },  // right foot
  { type: 'strength',    ax:  84, ay: 286, side: 'left',  cy: 0.17 },  // left arm
  { type: 'carrying',    ax: 455, ay: 355, side: 'right', cy: 0.50 },  // right glove
  { type: 'balance',     ax: 245, ay: 359, side: 'left',  cy: 0.39 },  // waist/core
  { type: 'size',        ax: 315, ay: 245, side: 'right', cy: 0.28 },  // jersey
  { type: 'elusiveness', ax: 495, ay: 830, side: 'right', cy: 0.94 },  // left glove
  { type: 'speed',       ax: 300, ay: 510, side: 'right', cy: 0.72 },  // thighs
]

// WR zones — same silhouette as RB, WR attribute keys mapped to matching body positions
const WR_ZONES = [
  { type: 'awareness',    ax: 313, ay: 110, side: 'right', cy: 0.07 },
  { type: 'size',         ax: 340, ay: 215, side: 'right', cy: 0.26 },
  { type: 'vertical',     ax: 163, ay: 653, side: 'left',  cy: 0.61 },
  { type: 'release',      ax: 500, ay: 635, side: 'right', cy: 0.64 },
  { type: 'hands',        ax: 115, ay: 100, side: 'left',  cy: 0.15 },
  { type: 'routeRunning', ax: 144, ay: 800, side: 'left',  cy: 0.84 },
  { type: 'afterCatch',   ax: 280, ay: 230, side: 'right', cy: 0.45 },
  { type: 'speed',        ax: 400, ay: 600, side: 'right', cy: 0.83 },
  { type: 'bodyControl',  ax: 205, ay: 375, side: 'left',  cy: 0.38 },
]

// TE zones — same silhouette as WR, blocking replaces bodyControl, strength replaces release
const TE_ZONES = [
  { type: 'awareness',    ax: 313, ay: 110, side: 'right', cy: 0.07 },
  { type: 'size',         ax: 290, ay: 335, side: 'right', cy: 0.64 },
  { type: 'vertical',     ax: 163, ay: 653, side: 'left',  cy: 0.61 },
  { type: 'strength',     ax: 340, ay: 215, side: 'right', cy: 0.26 },
  { type: 'hands',        ax: 115, ay: 100, side: 'left',  cy: 0.15 },
  { type: 'routeRunning', ax: 144, ay: 800, side: 'left',  cy: 0.84 },
  { type: 'afterCatch',   ax: 280, ay: 230, side: 'right', cy: 0.45 },
  { type: 'speed',        ax: 400, ay: 600, side: 'right', cy: 0.83 },
  { type: 'blocking',     ax: 160, ay: 240, side: 'left',  cy: 0.38 },
]

// DB silhouette coordinate space — matches public/db-silhouette.png pixel size exactly,
// DB_FIGURE_SCALE (below) handles the CSS scale-down; dot positions are
// corrected for it the same way RB/WR/Bucket are.
const DB_FIG_W = 479
const DB_FIG_H = 1028

// Mobile-only dot nudges in screen px (+x right, +y down), per DB zone
const DB_MOBILE_DOT_NUDGE_PX = {
  zoneIQ:          { x: 15, y: -5 },
  playRecognition: { x: 5,  y: -2 },
  manCoverage:     { x: -1, y: 3 },
  runSupport:      { x: -1, y: -14 },
  size:            { x: -10, y: 0 },
}

// DB anchor positions — ax/ay are exact path bounding-box centers from
// src/assets/db-figure-color.svg (the red dots on the body). cy is the
// CARD's vertical position, independent of ax/ay — evenly spaced per side
// (same approach as RB_ZONES) so cards never bunch up or overlap, rather
// than mirroring the dot's raw height. Kept tighter than RB_ZONES' 0.06–0.94
// span — DB's longer two-line labels (e.g. "PLAY RECOGNITION") make each
// card taller, so the full span pushed cards into the header/footer.
const DB_ZONES = [
  { type: 'zoneIQ',          ax: 297, ay:  75, side: 'right', cy: 0.23 }, // helmet
  { type: 'playRecognition', ax: 250, ay: 175, side: 'left',  cy: 0.14 }, // face/neckline
  { type: 'size',            ax: 220, ay: 260, side: 'left',  cy: 0.32 }, // jersey chest
  { type: 'press',           ax: 390, ay: 420, side: 'right', cy: 0.41 }, // sleeve/arm
  { type: 'runSupport',      ax: 169, ay: 395, side: 'left',  cy: 0.50 }, // thighs
  { type: 'fluidity',        ax: 373, ay: 700, side: 'right', cy: 0.77 }, // knee
  { type: 'hands',           ax: 446, ay: 650, side: 'right', cy: 0.59 }, // glove
  { type: 'speed',           ax: 130, ay: 814, side: 'left',  cy: 0.86 }, // shin
  { type: 'manCoverage',     ax: 45, ay: 555, side: 'left',  cy: 0.68 }, // shoe
]

// DL silhouette coordinate space: public/dl-silhouette.webp, wider than DB's figure.
const DL_FIG_W = 912
const DL_FIG_H = 1496
const DL_FIGURE_SCALE = 0.86

// DL zones: DB's nine card heights, dots on the part each trait colors (see DLFigureOverlay).
const DL_ZONES = [
  { type: 'playRecognition', ax: 531, ay:  82, side: 'right', cy: 0.23 }, // helmet
  { type: 'strength',        ax: 780, ay: 470, side: 'right', cy: 0.41 }, // bare arm
  { type: 'powerMoves',      ax: 838, ay: 590, side: 'right', cy: 0.59 }, // elbow pad
  { type: 'getOff',          ax: 793, ay: 1367, side: 'right', cy: 0.77 }, // shoe
  { type: 'blockShed',       ax: 148, ay: 370, side: 'left',  cy: 0.14 }, // arm sleeve
  { type: 'size',            ax: 420, ay: 500, side: 'left',  cy: 0.32 }, // jersey chest
  { type: 'finesseMoves',    ax: 90,  ay: 717, side: 'left',  cy: 0.50 }, // glove
  { type: 'bend',            ax: 441, ay: 913, side: 'left',  cy: 0.68 }, // knee
  { type: 'speed',           ax: 410, ay: 1043, side: 'left', cy: 0.86 }, // sock
]

// LB silhouette coordinate space: public/lb-silhouette.webp, squared up in his stance (wider and shorter than DL's).
const LB_FIG_W = 1005
const LB_FIG_H = 1267
const LB_FIGURE_SCALE = 0.9

// LB zones: DB's nine card heights, each dot on the part its trait colors (see LBFigureOverlay; the centres
// of the parts in src/assets/lb-figure-color.svg). Left cards top to bottom: neck, chest, arm, glove, lower leg;
// right: helmet, wristband, pants, shoe, so no two lines cross.
const LB_ZONES = [
  { type: 'leadership',      ax: 508, ay: 222, side: 'left',  cy: 0.14 }, // face + neck
  { type: 'size',            ax: 470, ay: 455, side: 'left',  cy: 0.32 }, // jersey chest
  { type: 'power',           ax: 268, ay: 470, side: 'left',  cy: 0.50 }, // bare arm
  { type: 'tackling',        ax: 171, ay: 699, side: 'left',  cy: 0.68 }, // glove
  { type: 'zoneInstincts',   ax: 223, ay: 1009, side: 'left', cy: 0.86 }, // lower leg
  { type: 'playRecognition', ax: 605, ay: 48,  side: 'right', cy: 0.23 }, // helmet
  { type: 'blockShed',       ax: 908, ay: 689, side: 'right', cy: 0.41 }, // wristband
  { type: 'passRush',        ax: 760, ay: 680, side: 'right', cy: 0.59 }, // pants, on his left thigh
  { type: 'range',           ax: 833, ay: 1184, side: 'right', cy: 0.77 }, // shoe
]

// OL silhouette coordinate space: public/ol-silhouette.webp, a lineman in a wide two-point pass set (narrower for
// its height than LB's art, and his hands reach both edges of it). On a phone it's drawn a size down, so both
// gloves stay clear of the cards and he stands as tall as the linebacker.
const OL_FIG_W = 888
const OL_FIG_H = 1289
const OL_FIGURE_SCALE = 0.9
const OL_FIGURE_SCALE_MOBILE = 0.78

// OL zones: DB's nine card heights, each dot on the part its trait colors (see OLFigureOverlay; the parts of
// src/assets/ol-figure-color.svg). Left cards top to bottom: neck, chest, pants, knee, long sock; right: helmet,
// bare arm, forearm sleeve, shoe, so no two lines cross. His arms and legs reach under the desktop cards: the
// sleeve's and the sock's dots sit level with the gap above their own card, the rest on the body between the columns.
const OL_ZONES = [
  { type: 'blitzPickup', ax: 446, ay: 214, side: 'left',  cy: 0.14 }, // face, under the cage
  { type: 'size',        ax: 300, ay: 440, side: 'left',  cy: 0.32 }, // jersey chest
  { type: 'runBlock',    ax: 290, ay: 690, side: 'left',  cy: 0.68 }, // pants, the thigh
  { type: 'pancake',     ax: 206, ay: 440, side: 'left',  cy: 0.50 }, // bare arm, inside the cards on desktop (pancake colors nothing)
  { type: 'anchor',      ax: 160, ay: 1030, side: 'left', cy: 0.86 }, // long sock
  { type: 'discipline',  ax: 440, ay: 48,  side: 'right', cy: 0.23 }, // helmet
  { type: 'length',      ax: 640, ay: 450, side: 'right', cy: 0.41 }, // bare arm
  { type: 'passPro',     ax: 720, ay: 645, side: 'right', cy: 0.59 }, // forearm sleeve
  { type: 'mobility',    ax: 780, ay: 1215, side: 'right', cy: 0.77 }, // shoe
]

// KICKER PLACEHOLDER: no kicker art yet, so a kicker is drawn on the QB figure (K_SILHOUETTE in data/ks.js) with three
// zones in its coordinate space. With real art: its own figure size, an overlay like OLFigureOverlay, and these three
// re-anchored (clutch: the helmet, accuracy: the plant foot or the chest, power: the kicking leg).
const K_ZONES = [
  { type: 'clutch',   ax: 275, ay:  42, side: 'left',  cy: 0.16 }, // helmet
  { type: 'accuracy', ax: 350, ay: 240, side: 'right', cy: 0.45 }, // chest
  { type: 'power',    ax: 207, ay: 525, side: 'left',  cy: 0.74 }, // legs
]
// (lib/kFigure.js kAsQB: a kicker's three chips color the QB figure's parts)

function useFigureBounds(ref, figW, figH) {
  const [bounds, setBounds] = useState(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const compute = () => {
      const W = ref.current.offsetWidth
      const H = ref.current.offsetHeight
      if (!W || !H) return
      const scale = Math.min(W / figW, H / figH)
      setBounds({
        W, H, scale,
        fx: (W - figW * scale) / 2,
        fy: (H - figH * scale) / 2,
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref, figW, figH])
  return bounds
}

function CZCard({ zone, cardY, build, activeDrag, hidden, invisible, isMobile, attrMap = ATTR, logoDir = '/logos/' }) {
  const meta  = attrMap[zone.type]
  const data  = build[zone.type]
  const filled = !!data

  return (
    <div
      className={[
        'cz-card', `cz-${zone.side}`, `cz-type-${zone.type}`,
        filled    && 'cz-filled',
        hidden    && 'cz-hidden',
        invisible && 'cz-invisible',
      ].filter(Boolean).join(' ')}
      style={{ top: `${cardY ?? 50}%` }}
    >
      <div className="cz-tag">{meta.label}</div>
      {filled && (
        <div className="cz-player-drop">
          <QBAvatar
            photo={data.photo}
            team={data.team}
            size={isMobile ? 26 : 53}
            logoDir={logoDir}
          />
          <span className="cz-qb-name">
            <span>{data.qbFull.split(' ')[0]}</span>
            <span>{data.qbFull.split(' ').slice(1).join(' ')}</span>
          </span>
        </div>
      )}
      {!filled && (
        <div className="cz-drop-hint" />
      )}
    </div>
  )
}

function HWTracker({ build, isRB = false, isWR = false, isTE = false, isBucket = false, isDB = false, isOL = false, isDL = false, isLB = false, isK = false }) {
  let ht, wt
  // College Football: off the chip itself (a college player isn't in the NFL lookups, and a name can be in both)
  const cfbChip = build['size']?.cfb ? build['size'] : null
  if (cfbChip) {
    ht = cfbChip.height ? fmtHeight(cfbChip.height) : null
    wt = cfbChip.weight ?? null
  } else if (isK) {
    // a kicker has no Size rating: the frame is the leg's (the Power chip)
    const kPhys = build['power'] ? (build['power'].height ? build['power'] : K_PHYS[build['power'].qbFull]) : null
    ht = kPhys?.height ? fmtHeight(kPhys.height) : null
    wt = kPhys?.weight ?? null
  } else if (isLB) {
    const lbPhys = build['size'] ? (build['size'].height ? build['size'] : LB_PHYS[build['size'].qbFull]) : null
    ht = lbPhys?.height ? fmtHeight(lbPhys.height) : null
    wt = lbPhys?.weight ?? null
  } else if (isDL) {
    const dlPhys = build['size'] ? (build['size'].height ? build['size'] : DL_PHYS[build['size'].qbFull]) : null
    ht = dlPhys?.height ? fmtHeight(dlPhys.height) : null
    wt = dlPhys?.weight ?? null
  } else if (isOL) {
    const chip = build['size']
    const olPhys = chip ? (OL_PHYSICALS[chip.qbFull] ?? (chip.height ? { height: chip.height, weight: chip.weight } : null)) : null
    ht = olPhys?.height ? fmtHeight(olPhys.height) : null
    wt = olPhys?.weight ?? null
  } else if (isBucket) {
    const chip = build['size']
    ht = chip?.height ? fmtHeight(chip.height) : null
    wt = chip?.weight ?? null
  } else if (isTE) {
    const tePhys = build['size'] ? ALL_TE_PHYS[build['size'].qbFull] : null
    ht = tePhys ? fmtHeight(tePhys.height) : null
    wt = tePhys ? tePhys.weight : null
  } else if (isWR) {
    const wrPhys = build['size'] ? ALL_WR_PHYS[build['size'].qbFull] : null
    ht = wrPhys ? fmtHeight(wrPhys.height) : null
    wt = wrPhys ? wrPhys.weight : null
  } else if (isRB) {
    const rbPhys = build['size'] ? ALL_RB_PHYS[build['size'].qbFull] : null
    ht = rbPhys ? fmtHeight(rbPhys.height) : null
    wt = rbPhys ? rbPhys.weight : null
  } else if (isDB) {
    const dbPhys = build['size'] ? DB_PHYS[build['size'].qbFull] : null
    ht = dbPhys ? fmtHeight(dbPhys.height) : null
    wt = dbPhys ? dbPhys.weight : null
  } else {
    const bodyPhys = build['size'] ? ALL_QB_PHYS[build['size'].qbFull] : null
    ht = bodyPhys ? fmtHeight(bodyPhys.height) : null
    wt = bodyPhys ? bodyPhys.weight : null
  }
  return (
    <div className="hw-tracker hw-tracker-pills">
      <div className="hw-stat">
        <span className="hw-label">HT</span>
        <span className={`hw-value${!ht ? ' hw-empty' : ''}`}>{ht ?? '--'}</span>
      </div>
      <div className="hw-divider" />
      <div className="hw-stat">
        <span className="hw-label">WT</span>
        <span className={`hw-value${!wt ? ' hw-empty' : ''}`}>
          {wt ? <>{wt} <span className="hw-unit">lbs</span></> : '--'}
        </span>
      </div>
    </div>
  )
}

const MOBILE_CARD_W = 22   // card CSS width (86px) minus card offset (64px each side)

// Basketball silhouette coordinate space (matches PNG pixel dimensions 936×897)
const BUCKET_FIG_W = 936
const BUCKET_FIG_H = 897
// Head center in bucket figure space (calibrated to basketballsilhouetteheadless.png)
const BUCKET_HEAD    = { ax: 468, ay: 74,  r: 54 }
const BUCKET_COLLAR_AY = 140  // SVG y where jersey collar meets shoulder (left stripe ends ~143)

const BUCKET_ZONES = [
  { type: 'basketballIQ',    ax: 415, ay:   -5, side: 'left',  cy: 0.015 },
  { type: 'clutch',          ax: 440, ay:  180, side: 'left',  cy: 0.690 },
  { type: 'jumpShot',        ax: 230, ay:  160, side: 'left',  cy: 0.526 },
  { type: 'finishing',       ax: 670, ay:  135, side: 'right', cy: 0.526 },
  { type: 'handles',         ax: 845, ay:  125, side: 'right', cy: 0.360, lineAnchor: 'top', lineAnchorOffsetX: 50 },
  { type: 'passing',         ax:  90, ay:  155, side: 'left',  cy: 0.360, lineAnchor: 'top' },
  { type: 'size',            ax: 610, ay:  430, side: 'right', cy: 0.044, noDot: true },
  { type: 'perimeterDefense',ax: 550, ay:  115, side: 'right', cy: 0.690 },
  { type: 'speed',           ax: 535, ay:  485, side: 'right', cy: 0.87 },
  { type: 'bounce',          ax: 390, ay:  820, side: 'left',  cy: 0.87 },
]

const BUCKET_BIG_ZONES = [
  { type: 'basketballIQ',   ax: 415, ay:   -5, side: 'left',  cy: 0.015 },
  { type: 'clutch',         ax: 440, ay:  180, side: 'left',  cy: 0.690 },
  { type: 'jumpShot',       ax: 230, ay:  160, side: 'left',  cy: 0.526 },
  { type: 'finishing',      ax: 670, ay:  135, side: 'right', cy: 0.526 },
  { type: 'playmaking',     ax: 845, ay:  125, side: 'right', cy: 0.360, lineAnchor: 'top', lineAnchorOffsetX: 50 },
  { type: 'rebounding',     ax:  90, ay:  155, side: 'left',  cy: 0.360, lineAnchor: 'top' },
  { type: 'size',           ax: 610, ay:  430, side: 'right', cy: 0.044, noDot: true },
  { type: 'interiorDefense',ax: 550, ay:  115, side: 'right', cy: 0.690 },
  { type: 'speed',          ax: 535, ay:  485, side: 'right', cy: 0.87 },
  { type: 'bounce',         ax: 390, ay:  820, side: 'left',  cy: 0.87 },
]

function getDominantPlayer(build) {
  const counts = {}
  Object.values(build).forEach(chip => {
    if (!chip) return
    counts[chip.qbFull] = (counts[chip.qbFull] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

// `modelOnly`: just the player — figure, jersey overlay and face — with no
// dots, cards, measurement lines or backdrop, sized to its container (the app's
// Career model). Nothing else changes when it's off.
// SOCCER PLACEHOLDER: a striker is drawn on the basketball figure (SOCCER_SILHOUETTE in lib/soccerUi.js)
// until his own art lands. Each striker trait rides on one basketball trait's spot and body part
// (SOCCER_AS_BUCKET), so the build screen runs the basketball figure unchanged: the build, the
// traits, the labels, the tabs and the drag are handed in under the basketball keys.
const toBkt = t => SOCCER_AS_BUCKET[t] ?? t
export default function Silhouette(props) {
  const { isSoccer = false, build, types = TYPES, attrMap = ATTR, categoriesData = CATEGORIES, activeDrag } = props
  const mapped = useMemo(() => (isSoccer ? {
    build: soccerAsBucketBuild(build),
    types: types.map(toBkt),
    attrMap: Object.fromEntries(Object.entries(attrMap).map(([t, m]) => [toBkt(t), m])),
    categoriesData: categoriesData.map(c => ({ ...c, types: c.types.map(toBkt) })),
  } : null), [isSoccer, build, types, attrMap, categoriesData])
  if (props.isBaseball) return <BaseballSilhouette {...props} />
  if (!isSoccer) return <SilhouetteFigure {...props} />
  return <SilhouetteFigure {...props} {...mapped} isBucket activeDrag={activeDrag ? { ...activeDrag, type: toBkt(activeDrag.type) } : activeDrag} />
}
// BASEBALL PLACEHOLDER: a batter or a pitcher on the basketball figure (BASEBALL_SILHOUETTE in lib/baseballUi.js),
// the same way: each trait on one basketball spot (BASEBALL_AS_BUCKET, per position), only the position's ten
function BaseballSilhouette(props) {
  const { baseballPos = 'bat', build, types = TYPES, attrMap = ATTR, categoriesData = CATEGORIES, activeDrag } = props
  const m = BASEBALL_AS_BUCKET[baseballPos === 'pit' ? 'pit' : 'bat']
  const to = t => m[t] ?? t
  const mapped = useMemo(() => ({
    build: Object.fromEntries(Object.entries(build ?? {}).map(([t, c]) => [to(t), c])),
    types: types.map(to),
    attrMap: Object.fromEntries(types.map(t => [to(t), attrMap[t]])),
    categoriesData: categoriesData.map(c => ({ ...c, types: c.types.map(to) })),
  }), [baseballPos, build, types, attrMap, categoriesData]) // eslint-disable-line react-hooks/exhaustive-deps
  return <SilhouetteFigure {...props} {...mapped} isBucket activeDrag={activeDrag ? { ...activeDrag, type: to(activeDrag.type) } : activeDrag} />
}

function SilhouetteFigure({ build, activeDrag, onDrop, activeCategory, onCategoryChange, types = TYPES, isLite = false, onReset, isRB = false, isWR = false, isTE = false, isDB = false, isOL = false, isK = false, isDL: isDLPos = false, isLB = false, isBucket = false, isSoccer = false, isBaseball = false, logoDir: logoDirProp = null, kitNick = null, isPlus = false, isCustomMode = false, onOpenCustomModal, onSandboxToggle, sandboxStarters = null, attrMap = ATTR, categoriesData = CATEGORIES, figureRef, modelOnly = false }) {
  // LB is drawn on the DL figure for now (LB PLACEHOLDER above): everything figure-related follows DL
  const isDL = isDLPos || isLB
  const figW   = isBucket ? BUCKET_FIG_W : isLB ? LB_FIG_W : isDL ? DL_FIG_W : isOL ? OL_FIG_W : isDB ? DB_FIG_W : (isRB || isWR || isTE ? RB_FIG_W : FIG_W)
  const figH   = isBucket ? BUCKET_FIG_H : isLB ? LB_FIG_H : isDL ? DL_FIG_H : isOL ? OL_FIG_H : isDB ? DB_FIG_H : (isRB || isWR || isTE ? RB_FIG_H : FIG_H)
  const zones  = isK ? K_ZONES : isBucket ? (types.includes('interiorDefense') ? BUCKET_BIG_ZONES : BUCKET_ZONES) : isLB ? LB_ZONES : isDL ? DL_ZONES : isOL ? OL_ZONES : isDB ? DB_ZONES : isTE ? TE_ZONES : isWR ? WR_ZONES : isRB ? RB_ZONES : ZONES
  const silRef = useRef(null)
  const bounds = useFigureBounds(silRef, figW, figH)
  const boundsRef = useRef(bounds)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  const activeDragRef = useRef(activeDrag)
  const onDropRef = useRef(onDrop)
  const zonesRef = useRef(zones)
  useLayoutEffect(() => { boundsRef.current = bounds }, [bounds])
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])
  useLayoutEffect(() => { onDropRef.current = onDrop }, [onDrop])
  useLayoutEffect(() => { zonesRef.current = zones }, [zones])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Native drop — only registers within ~80 figure-units of the zone dot
  useEffect(() => {
    const el = silRef.current
    if (!el) return
    const onDragOver = (e) => e.preventDefault()
    const onDropNative = (e) => {
      e.preventDefault()
      const ad = activeDragRef.current
      if (!ad) return
      const b = boundsRef.current
      if (!b) return
      const rect = el.getBoundingClientRect()
      const { W, H, fx, fy, scale } = b
      const figX = ((e.clientX - rect.left) / rect.width  * W - fx) / scale
      const figY = ((e.clientY - rect.top)  / rect.height * H - fy) / scale
      const zone = zonesRef.current.find(z => z.type === ad.type)
      if (!zone) return
      const dist = Math.sqrt((figX - zone.ax) ** 2 + (figY - zone.ay) ** 2)
      if (dist <= 80) onDropRef.current(ad.type)
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDropNative)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDropNative)
    }
  }, [])

  const cats = isTE ? categoriesData : isWR ? WR_CATEGORIES : isRB ? RB_CATEGORIES : categoriesData
  const categoryTypes = activeCategory
    ? (cats.find(c => c.id === activeCategory)?.types ?? [])
    : null
  const complete = types.every(t => build[t])

  // Headshot only from basketballIQ slot for bucket builds
  const bucketPhoto = isBucket ? (build['basketballIQ']?.photo || null) : null
  // the figure scales that make it fill the build screen; a model fits its box as-is
  const appBucket = (IS_APP || APP_LOOK) && isBucket && isMobile && !modelOnly
  // (the model keeps the build screen's bucket scale: the jersey overlay and the face
  // are drawn against the figure at that size, so changing it alone splits the layers)
  const bucketScale = appBucket ? APP_BKT.scale : BUCKET_FIGURE_SCALE
  const rbScale = modelOnly ? 1 : RB_FIGURE_SCALE
  const dbScale = modelOnly ? 1 : DB_FIGURE_SCALE
  const dlScale = modelOnly ? 1 : DL_FIGURE_SCALE
  // the build screen: his arm out to one side pulls the body off centre, so the whole figure sits a little left
  const dlTransform = modelOnly ? 'none' : `translateX(-5%) scale(${dlScale})`
  // (the linebacker's body sits right of the art's centre too: the same nudge left)
  const lbTransform = modelOnly ? 'none' : `translateX(-5%) scale(${LB_FIGURE_SCALE})`
  // (the lineman stands in the middle of his art: scaled about the centre, no nudge)
  const olScale = isMobile ? OL_FIGURE_SCALE_MOBILE : OL_FIGURE_SCALE
  const olTransform = modelOnly ? 'none' : `scale(${olScale})`
  const wrTransform = modelOnly ? 'none' : isMobile ? `translateY(-6px) scale(${WR_FIGURE_SCALE_MOBILE})` : `scale(${WR_FIGURE_SCALE})`

  // Sample bottom color + capture aspect ratio for correct objectPosition centering
  const [hsBottomColor, setHsBottomColor] = useState(null)
  const [hsImgRatio, setHsImgRatio] = useState(1.333)  // h/w, default 3:4 portrait
  useEffect(() => {
    if (!bucketPhoto) { setHsBottomColor(null); setHsImgRatio(1.333); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight
      const R = ih / iw
      setHsImgRatio(R)

      // Sample color at bottom of visible headshot (jersey area)
      const S = 200
      const canvas = document.createElement('canvas')
      canvas.width = S; canvas.height = S
      const ctx = canvas.getContext('2d')
      const sc = Math.max(S / iw, S / ih)
      const sw = iw * sc, sh = ih * sc
      // objectFit:cover + objectPosition:50% 50% draw position
      const ox = (S - sw) / 2, oy = (S - sh) / 2
      ctx.drawImage(img, ox, oy, sw, sh)
      const sampleY = Math.round(S * 0.88)
      const sampleX = Math.round(S / 2)
      const radius = 8
      let r = 0, g = 0, b = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const py = Math.min(S - 1, Math.max(0, sampleY + dy))
          const px = Math.min(S - 1, Math.max(0, sampleX + dx))
          const d = ctx.getImageData(px, py, 1, 1).data
          r += d[0]; g += d[1]; b += d[2]; count++
        }
      }
      setHsBottomColor(`rgb(${Math.round(r/count)},${Math.round(g/count)},${Math.round(b/count)})`)
    }
    img.onerror = () => setHsBottomColor(null)
    img.src = bucketPhoto
  }, [bucketPhoto])

  // App basketball: each side's cards spaced evenly down the body. The arm dots
  // (out past the body) take the top cards, outermost first, and the rest follow
  // top to bottom, so the lines fan out and never cross; the top card's line runs
  // from its top edge (its dot is out on the hand, past the card's side).
  const appRows = useMemo(() => {
    if (!appBucket) return null
    const rows = {}, top = new Set()
    const arm = z => (z.side === 'left' ? z.ax < 300 : z.ax > BUCKET_FIG_W - 300)
    for (const side of ['left', 'right']) {
      const out = z => (side === 'left' ? z.ax : -z.ax)   // smaller = further out
      // a trait with no dot (Size: the height and wingspan read off the whole body) takes
      // its own spot up top, like the live site; the rest stack down the side
      zones.filter(z => z.side === side && types.includes(z.type) && z.noDot).forEach(z => { rows[z.type] = APP_BKT.noDotRow })
      const list = zones.filter(z => z.side === side && types.includes(z.type) && !z.noDot)
        .sort((a, b) => (arm(a) !== arm(b) ? (arm(a) ? -1 : 1) : arm(a) ? out(a) - out(b) : a.ay - b.ay))
      list.forEach((z, i) => { rows[z.type] = APP_BKT.top + (APP_BKT.bottom - APP_BKT.top) * (list.length > 1 ? i / (list.length - 1) : 0.5) })
      if (list[0] && arm(list[0]) && !list[0].noDot) top.add(list[0].type)
    }
    rows.top = top
    return rows
  }, [appBucket, zones, types])

  // Convert figure-space (ax, ay) → sil-wrap percentage coords
  const pos = (zone) => {
    if (!bounds) return null
    if (appBucket) {
      const { W, H, fx, fy, scale } = bounds
      const dotX = ((fx + zone.ax * scale) / W * 100 - 50) * bucketScale + 50
      const dotY = ((fy + zone.ay * scale) / H * 100 - 50) * bucketScale + 50
      const cardY = (appRows?.[zone.type] ?? zone.cy) * 100
      const edge = APP_BKT.cardIn + APP_BKT.cardW
      const lineX = zone.side === 'left' ? edge / W * 100 : (W - edge) / W * 100
      const stub = APP_BKT.stub / W * 100
      const stubX = zone.side === 'left' ? lineX + stub : lineX - stub
      const cardCenterX = zone.side === 'left' ? (APP_BKT.cardIn + APP_BKT.cardW / 2) / W * 100 : 100 - (APP_BKT.cardIn + APP_BKT.cardW / 2) / W * 100
      // the top card's line leaves from its top edge (half a card, ~27px, above its middle)
      const topY = appRows?.top?.has(zone.type) ? cardY - 27 / H * 100 : null
      return { dotX, dotY, cardY, lineX, stubX, cardCenterX, cardHalfH: 0, anchorNudgeX: 0, anchorNudgeY: 0, side: true, topY }
    }
    const { W, H, fx, fy, scale } = bounds
    const bucketCardScale = 0.88
    const cardEdgePx = isMobile
      ? isBucket
        ? -64 + (86 / 2) * (1 + bucketCardScale)   // -64px offset + scaled half-width × 2
        : MOBILE_CARD_W + (86 / 2) * 0.15           // default scale 1.15
      : isBucket
        ? (CARD_W / 2) + (CARD_W / 2) * bucketCardScale
        : CARD_W * 1.075
    let dotX  = (fx + zone.ax * scale) / W * 100
    let dotY  = (fy + zone.ay * scale) / H * 100 + (!isMobile && zone.type === 'size' ? (isBucket ? 60 : 30) / H * 100 : 0)
    // Compensate for CSS scale on RB/WR/bucket figure — scale dot positions outward/inward from center
    if (isRB) {
      dotX = (dotX - 50) * RB_FIGURE_SCALE + 50
      dotY = (dotY - 50) * RB_FIGURE_SCALE + 50
    }
    if (isWR || isTE) {
      dotX = (dotX - 50) * WR_FIGURE_SCALE + 50
      dotY = (dotY - 50) * WR_FIGURE_SCALE + 50
    }
    if (isBucket) {
      dotX = (dotX - 50) * BUCKET_FIGURE_SCALE + 50
      dotY = (dotY - 50) * BUCKET_FIGURE_SCALE + 50
    }
    if (isLB) {
      dotX = (dotX - 50) * LB_FIGURE_SCALE + 50
      dotY = (dotY - 50) * LB_FIGURE_SCALE + 50
      dotX -= 5
    } else if (isDL) {
      dotX = (dotX - 50) * DL_FIGURE_SCALE + 50
      dotY = (dotY - 50) * DL_FIGURE_SCALE + 50
      dotX -= 5
    }
    if (isOL) {
      dotX = (dotX - 50) * olScale + 50
      dotY = (dotY - 50) * olScale + 50
    }
    if (isDB) {
      dotX = (dotX - 50) * DB_FIGURE_SCALE + 50
      dotY = (dotY - 50) * DB_FIGURE_SCALE + 50
      const nudge = isMobile ? DB_MOBILE_DOT_NUDGE_PX[zone.type] : null
      if (nudge) {
        dotX += nudge.x / W * 100
        dotY += nudge.y / H * 100
      }
    }
    const zoneCardYNudgePx = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? -15 : zone.type === 'speed' ? 25 : zone.type === 'size' ? -100 : zone.type === 'handles' || zone.type === 'playmaking' ? -10 : 0)
      : 0
    const cardY = isMobile
      ? ((zone.cy - 0.5) * (isDB || isDL || isOL ? 0.98 : 0.92) + 0.5) * 100
      : zone.cy * 100 + (zoneCardYNudgePx / H) * 100
    const lineInsetPx = (!isMobile && isBucket) ? 10 : 0
    // Per-zone desktop line X nudge (positive = inward for both sides)
    const zoneLineNudge = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? -50 : zone.type === 'handles' || zone.type === 'playmaking' ? -50 : 0)
      : 0
    const lineX = zone.side === 'left'
      ? ((cardEdgePx + lineInsetPx - zoneLineNudge) / W) * 100
      : ((W - cardEdgePx - lineInsetPx + zoneLineNudge) / W) * 100
    const stubPx = isMobile ? 12 : (isBucket ? 88 : 125)
    const stub   = stubPx / W * 100
    // (the stub stops short of its dot: on a narrower desktop window, or the wide DL figure, a dot close to its card folded the line back on itself)
    const stubX  = zone.side === 'left' ? Math.max(lineX, Math.min(lineX + stub, dotX - 1.5)) : Math.min(lineX, Math.max(lineX - stub, dotX + 1.5))
    // Center X of the card face (for top-anchor lines)
    // Left cards: left:0, so center = half card rendered width from left
    // Right cards: right:0, so center = W minus half card rendered width
    const cardScale = isBucket ? 0.88 : 1.15
    const cardHalfW = isMobile
      ? (86 / 2) / W * 100
      : (CARD_W * cardScale / 2) / W * 100
    const cardCenterX = zone.side === 'left'
      ? cardHalfW
      : 100 - cardHalfW
    const cardHalfH = isMobile
      ? (130 * 0.55 / 2) / H * 100
      : (130 * (isBucket ? 0.88 : 1.15) / 2) / H * 100
    // Per-zone desktop anchor nudges for top-anchor lines
    const anchorNudgeX = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? (295 / W) * 100 : zone.type === 'handles' || zone.type === 'playmaking' ? (-300 / W) * 100 : 0)
      : 0
    const anchorNudgeY = (!isMobile && isBucket)
      ? (zone.type === 'passing' || zone.type === 'rebounding' ? (-70 / H) * 100 : zone.type === 'handles' || zone.type === 'playmaking' ? (-60 / H) * 100 : 0)
      : 0
    return { dotX, dotY, cardY, lineX, stubX, cardCenterX, cardHalfH, anchorNudgeX, anchorNudgeY }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const zonePosMap = useMemo(() => {
    const map = {}
    zones.forEach(z => { map[z.type] = pos(z) })
    return map
  }, [bounds, isMobile, isBucket, isRB, isWR, isTE, isDB, isOL, isDL, zones, appRows])

  return (
    <section className="field-center" style={isBucket ? { backgroundColor: '#090a0d' } : undefined}>
      {isBucket && !modelOnly && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }}>
          {/* (baseball: the ballpark drawn taller from its foot, so the light towers stay above the frame: on a phone
              their haze landed on the ends of the category tabs and read as a glow on them) */}
          <div style={{ position: 'absolute', inset: '-20px', backgroundImage: isBaseball ? `url('${BASEBALL_SILHOUETTE.backdrop}')` : isSoccer ? "url('/soccerbackground.webp')" : "url('/bucketbackground.webp')", backgroundSize: isBaseball ? 'auto 135%' : 'cover', backgroundPosition: isBaseball ? 'center 100%' : 'center', filter: 'blur(4px) brightness(1.4)' }} />
        </div>
      )}
      {!isBucket && !modelOnly && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }}>
          {/* the new UI: the blur and the dimming are baked into the image (a live filter repainted 900px every scroll frame) */}
          {IS_APP || APP_LOOK
            ? <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/footballbackground-blur.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
            : <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/footballbackground.webp')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(4px) brightness(0.7)' }} />}
        </div>
      )}
      {!modelOnly && <div className="category-pills">
        <HWTracker build={build} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} isOL={isOL} isK={isK} isDL={isDLPos} isLB={isLB} isBucket={isBucket} />
        {cats.map(cat => (
          <button
            key={cat.id}
            className={`cat-pill ${(complete || activeCategory === cat.id) ? 'active' : ''}`}
            style={(isLite || isK) ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
            onClick={() => !complete && activeCategory !== cat.id && onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>}
      {/* app-look website, desktop: the compact Sandbox card in the corner (the phone gets the full card in the report card) */}
      {!!onSandboxToggle && !IS_APP && APP_LOOK && !modelOnly && (
        <div className="sil-sandbox-outer sil-sandbox-outer--app">
          <AppSandbox compact on={!!isCustomMode} onToggle={v => onSandboxToggle?.(v)} onCustomize={onOpenCustomModal} starters={sandboxStarters} />
        </div>
      )}
      {!!onSandboxToggle && !IS_APP && !APP_LOOK && (
        <div className="sil-sandbox-outer">
          <div className="sil-sandbox-toprow">
            <div
              className={`sil-sandbox-wrap${isCustomMode ? ' sil-sandbox-wrap--active' : ''}`}
              onClick={() => onSandboxToggle?.(!isCustomMode)}
            >
              <span className="sil-sandbox-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6" />
                  <path d="M10 3v6.7L4.4 18.9a1.8 1.8 0 0 0 1.6 2.6h12a1.8 1.8 0 0 0 1.6-2.6L14 9.7V3" />
                  <path d="M6.6 15h10.8" />
                </svg>
              </span>
              <span className="sil-sandbox-label">Sandbox</span>
              <label className="plus-toggle">
                <input type="checkbox" checked={!!isCustomMode} readOnly />
                <span className="plus-toggle-track" />
              </label>
              <div className="sil-sandbox-info" onClick={e => e.stopPropagation()}>
                <button className="sil-sandbox-info-btn" type="button">?</button>
                <div className="sil-sandbox-tooltip">Customize your build and player ratings.<br />Sandbox results aren't saved to your profile or the leaderboard.</div>
              </div>
            </div>
          </div>
          {isCustomMode && (
            <button className="sil-custom-ratings-btn" onClick={onOpenCustomModal}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="16" cy="18" r="2" fill="currentColor" stroke="none" />
              </svg>
              Customize
            </button>
          )}
        </div>
      )}

      <div className={`sil-wrap${isRB ? ' sil-wrap--rb' : ''}${modelOnly ? ' sil-wrap--model' : ''}${appBucket ? ' sil-wrap--app-bkt' : ''}`} ref={silRef}>
        {isBucket && !modelOnly && !isMobile && (
          <div style={{
            position: 'absolute',
            left: '50%', top: 'calc(15% + 42px)',
            transform: 'translate(-50%, -50%)',
            width: '40px', height: '40px',
            background: build?.['clutch']?.teamColor || '#333333',
            zIndex: 2,
            pointerEvents: 'none',
          }} />
        )}

        {/* Measurement outlines — height + wingspan derived from size val (not baseball's: a wingspan is a basketball number) */}
        {isBucket && !isBaseball && !modelOnly && (build?.['size'] || build?.['heightLength']) && (() => {
          const chip = build['size'] || build['heightLength']
          const val  = chip.val ?? 5
          const col  = '#ffffff'

          const heightIn   = chip.height ?? Math.round(72 + (val - 1) * 16 / 9)
          const wingspanIn = chip.wingspan ?? Math.round(heightIn + 1 + (val - 1) * 8 / 9)

          // Player boundaries in bucket SVG viewBox coords (42.5 -35.2 850.9 815.5)
          const headY  = -85
          const footY  = 818
          const leftX  = -4
          const rightX = 940
          const midX   = 468
          const midY   = (headY + footY) / 2

          // Height bracket — right side
          const hx     = 682
          const tickH  = 10
          // Wingspan bracket — horizontal near feet
          const wy     = -28
          const tickW  = 10

          const lw  = 3.5
          const op  = 0.75
          const op2 = 1.0
          const font = "'Bebas Neue', monospace, sans-serif"

          return (
            <svg
              viewBox="42.5 -35.2 850.9 815.5"
              preserveAspectRatio="xMidYMid meet"
              // drawn for the website's figure (scaled BUCKET_FIGURE_SCALE); the app's phone
              // figure is scaled differently, so the brackets follow it (like the jersey overlay)
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', ...(bucketScale !== BUCKET_FIGURE_SCALE ? { transform: `scale(${bucketScale / BUCKET_FIGURE_SCALE})`, transformOrigin: 'center center' } : {}) }}
              aria-hidden="true"
            >
              {/* HEIGHT: right-side vertical bracket */}
              <line x1={hx} y1={headY} x2={hx} y2={footY} stroke={col} strokeWidth={lw} strokeDasharray="7 5" opacity={op} />
              <line x1={hx - tickH} y1={headY} x2={hx + tickH} y2={headY} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <line x1={hx - tickH} y1={footY} x2={hx + tickH} y2={footY} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <text
                x={hx + 12} y={midY + 150}
                textAnchor="middle"
                fontFamily={font}
                fontSize="45"
                fill={col}
                opacity={op2}
                transform={`rotate(90, ${hx + 12}, ${midY + 150})`}
                style={{ userSelect: 'none' }}
              >{fmtHeight(heightIn)}  HEIGHT</text>

              {/* WINGSPAN: horizontal bracket near feet */}
              <line x1={leftX} y1={wy} x2={rightX} y2={wy} stroke={col} strokeWidth={lw} strokeDasharray="7 5" opacity={op} />
              <line x1={leftX} y1={wy - tickW} x2={leftX} y2={wy + tickW} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <line x1={rightX} y1={wy - tickW} x2={rightX} y2={wy + tickW} stroke={col} strokeWidth={lw * 1.3} opacity={op2} />
              <text
                x={midX - 200} y={wy + 36}
                textAnchor="middle"
                fontFamily={font}
                fontSize="41"
                fill={col}
                opacity={op2}
                style={{ userSelect: 'none' }}
              >{fmtHeight(wingspanIn)} WINGSPAN</text>
            </svg>
          )
        })()}

        <div ref={isBucket ? figureRef : undefined} style={{ position: 'absolute', inset: 0, ...(isBucket ? { pointerEvents: 'none' } : {}) }}>
        <img
          src={
            isBucket
              ? (isBaseball ? (bucketPhoto ? BASEBALL_SILHOUETTE.headless : BASEBALL_SILHOUETTE.src) : isSoccer ? (bucketPhoto ? SOCCER_SILHOUETTE.headless : SOCCER_SILHOUETTE.src) : bucketPhoto ? '/basketballsilhouetteheadless.png' : '/basketballsilhouette.png')
              : isLB ? LB_SILHOUETTE
              : isDL ? '/dl-silhouette.webp'
              : isOL ? OL_SILHOUETTE
              : isDB ? '/db-silhouette.png'
              : (isWR || isTE) ? '/wr-silhouette.png'
              : isRB ? '/rb-silhouette.webp'
              : '/qb-silhouette.webp'
          }
          alt=""
          className={`sil-img${(isRB || isWR || isTE) ? ' sil-img--rb' : ''}${isBucket ? ' sil-img--bucket' : ''}${complete ? ' sil-img--done' : ''}`}
          draggable={false}
          style={
            isBucket   ? { transform: `scale(${bucketScale})`, transformOrigin: 'center center' }
            : (isWR || isTE) ? { transform: wrTransform, transformOrigin: 'center center', filter: complete ? 'none' : 'brightness(0.55) drop-shadow(0 0 2px rgba(255,255,255,0.60)) drop-shadow(0 0 0.5px rgba(255,255,255,0.92))' }
            : isRB     ? { transform: `scale(${rbScale})`, transformOrigin: 'center center' }
            : isLB     ? { transform: lbTransform, transformOrigin: 'center center' }
            : isDL     ? { transform: dlTransform, transformOrigin: 'center center' }
            : isOL     ? { transform: olTransform, transformOrigin: 'center center' }
            : isDB  ? { transform: `scale(${dbScale})`, transformOrigin: 'center center', filter: 'brightness(0.35)' }
            : undefined
          }
        />
        {isBucket && (appBucket
          // the overlay's viewBox is cropped for the website's 1.1× figure; match the app's scale
          // (zIndex 5: the scale makes this its own layer, which would otherwise sit under
          // the silhouette png (z 4) and hide the jersey colours)
          ? <div style={{ position: 'absolute', inset: 0, zIndex: 5, transform: `scale(${bucketScale / BUCKET_FIGURE_SCALE})`, transformOrigin: 'center center' }}><BucketFigureOverlay build={build} logoDir={logoDirProp} nickOf={kitNick} /></div>
          : <BucketFigureOverlay build={build} logoDir={logoDirProp} nickOf={kitNick} />)}
        {isBucket && bucketPhoto && bounds && (() => {
          const { W, H, fx, fy, scale } = bounds
          const hxRaw    = (fx + BUCKET_HEAD.ax    * scale) / W * 100
          const collarYRaw = (fy + BUCKET_COLLAR_AY * scale) / H * 100
          const hx       = 50 + (hxRaw     - 50) * bucketScale
          const collarY  = 50 + (collarYRaw - 50) * bucketScale
          const faceChip = build['basketballIQ']
          const fc = faceChip?.faceCenter
          const hpx = BUCKET_HEAD.r * 2 * scale * 1.805 * bucketScale
          const R = hsImgRatio
          // Target face at ~58% of container: with clip bottom (89%) at collar,
          // this places the face near the silhouette head center
          const objPosY = fc && Math.abs(R - 1) > 0.05
            ? Math.max(0, Math.min(100, 100 * (0.58 - (fc[1] / 100) * R) / (1 - R)))
            : (fc ? fc[1] : 50)
          const objPos = `50% ${objPosY}%`
          const clipY = 45
          const faceScale = fc ? Math.max(0.93, Math.min(1.12, 1 + (42 - fc[1]) * 0.014)) : 1
          const adj = faceChip?.faceAdjust || { dx: 0, dy: 0, scale: 1 }
          const isGeneric = bucketPhoto === '/genericdark.webp' || bucketPhoto === '/genericlight.webp'
          const isGenericLight = bucketPhoto === '/genericlight.webp'
          const genericYAdj = isGenericLight ? 2.5 : isGeneric ? 4.5 : 0
          // Desktop-only nudge for the two generic (no-headshot) placeholders
          const genericDesktopX = isGeneric && !isMobile ? 2.5 : 0
          const genericDesktopY = isGeneric && !isMobile ? 16 : 0
          // the px nudges were tuned on the website build screen (a ~131px head); a model
          // is drawn smaller, so scale them with it or the head sinks into the collar
          const k = modelOnly ? hpx / 131 : 1
          return (
            <div
              key={bucketPhoto}
              style={{
                position: 'absolute',
                left: `${hx}%`,
                top: `${collarY}%`,
                width: `${hpx}px`,
                height: `${hpx}px`,
                transform: `translate(calc(-50% + ${k * (0.75 + adj.dx + (isGeneric ? 0.75 : 0) + genericDesktopX)}px), calc(-89% + ${k * (4 + adj.dy + genericYAdj + genericDesktopY)}px))`,
                overflow: 'hidden',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 1,
                WebkitMaskImage: `radial-gradient(ellipse 82% 78% at 50% ${clipY}%, black 52%, transparent 84%)`,
                maskImage: `radial-gradient(ellipse 82% 78% at 50% ${clipY}%, black 52%, transparent 84%)`,
              }}
            >
              <img
                src={bucketPhoto}
                alt=""
                draggable={false}
                onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: objPos,
                  transform: `scale(${(faceScale * adj.scale) * (isGenericLight ? 1.05 : 1)}) rotate(${adj.rotate ?? 0}deg)`,
                  transformOrigin: `50% ${objPosY}%`,
                  filter: 'saturate(0.75) contrast(1.05)',
                }}
              />
            </div>
          )
        })()}
        </div>
        {!isRB && !isWR && !isTE && !isDB && !isDL && !isOL && !isBucket && <QBFigureOverlay build={isK ? kAsQB(build) : build} className="player-qbfig" />}
        {isDB && (
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${dbScale})`, transformOrigin: 'center center' }}>
            <DBFigureOverlay build={build} numberNudgePx={isMobile && !modelOnly ? { x: 7, y: 7 } : null} />
          </div>
        )}
        {isDLPos && (
          <div style={{ position: 'absolute', inset: 0, transform: dlTransform, transformOrigin: 'center center' }}>
            <DLFigureOverlay build={build} numberNudgePx={null} nameNudge={isMobile && !modelOnly ? { x: -12, y: 12 } : null} />
          </div>
        )}
        {isLB && (
          <div style={{ position: 'absolute', inset: 0, transform: lbTransform, transformOrigin: 'center center' }}>
            <LBFigureOverlay build={build} />
          </div>
        )}
        {isOL && (
          <div style={{ position: 'absolute', inset: 0, transform: olTransform, transformOrigin: 'center center' }}>
            <OLFigureOverlay build={build} />
          </div>
        )}
        {isRB && (
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${rbScale})`, transformOrigin: 'center center' }}>
            <RBFigureOverlay build={build} />
          </div>
        )}
        {(isWR || isTE) && (
          <div style={{ position: 'absolute', inset: 0, transform: wrTransform, transformOrigin: 'center center' }}>
            <WRFigureOverlay build={build} isTE={isTE} />
          </div>
        )}

        {/* Lines — stretch to fill sil-wrap via preserveAspectRatio="none" */}
        {!modelOnly && <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="cz-lines-svg"
          aria-hidden="true"
        >
          {zones.filter(z => types.includes(z.type) && !z.noDot).map(zone => {
            const hidden = !(isLite || isK) && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = zonePosMap[zone.type]
            if (!p) return null
            const cardTopY = p.cardY - p.cardHalfH
            const anchorX = p.cardCenterX - 25 + (zone.lineAnchorOffsetX ?? 0) + (p.anchorNudgeX ?? 0)
            const anchorY = cardTopY + 10 + (p.anchorNudgeY ?? 0)
            const d = p.topY != null
              ? `M ${p.cardCenterX} ${p.topY} L ${p.dotX} ${p.dotY}`
              : zone.lineAnchor === 'top' && !p.side
              ? `M ${anchorX} ${anchorY} L ${anchorX} ${anchorY - 8} L ${p.dotX} ${p.dotY}`
              : `M ${p.lineX} ${p.cardY} L ${p.stubX} ${p.cardY} L ${p.dotX} ${p.dotY}`
            return (
              <path
                key={zone.type}
                d={d}
                stroke={isBaseball ? '#c8102e' : isSoccer ? '#f4f4f5' : isBucket ? '#f97316' : '#e8192c'}
                strokeWidth="0.3"
                fill="none"
                style={{ opacity: hidden ? 0 : 1 }}
              />
            )
          })}
        </svg>}

        {/* Dots + cards */}
        {!modelOnly && <div className="cz-layer" style={{ zIndex: 10 }}>
          {zones.filter(z => types.includes(z.type)).map(zone => {
            const hiddenFromTab = !(isLite || isK) && !complete && (!activeCategory || !categoryTypes?.includes(zone.type))
            const p = zonePosMap[zone.type]
            return (
              <div key={zone.type}>
                {p && !zone.noDot && (
                  <div
                    className={['cz-dot', hiddenFromTab && 'cz-hidden'].filter(Boolean).join(' ')}
                    style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }}
                  />
                )}
                {p && !zone.noDot && !hiddenFromTab && activeDrag?.type === zone.type && !build[zone.type] && (
                  <div className="cz-drop-zone" style={{ left: `${p.dotX}%`, top: `${p.dotY}%` }} />
                )}
                <CZCard
                  zone={zone}
                  cardY={p?.cardY}
                  build={build}
                  activeDrag={activeDrag}
                  hidden={!p}
                  invisible={hiddenFromTab && !!p}
                  isMobile={isMobile}
                  attrMap={attrMap}
                  logoDir={logoDirProp ?? (isBucket ? '/logos/nba/' : '/logos/')}
                />
              </div>
            )
          })}
        </div>}

        {onReset && (
          <button className="sil-reset-btn" onClick={onReset}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span>Reset</span>
          </button>
        )}

      </div>


    </section>
  )
}
