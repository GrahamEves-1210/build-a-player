import { useState, useEffect, useRef } from 'react'
import { ATTR, TYPES, LITE_TYPES } from '../data/qbs'
import { RB_TYPES, RB_LITE_TYPES } from '../data/rbs'
import { WR_TYPES, WR_LITE_TYPES, WR_ATTR } from '../data/wrs'
import { TE_ATTR, TE_TYPES, TE_LITE_TYPES } from '../data/tes'
import { DB_ATTR, DB_TYPES, DB_LITE_TYPES } from '../data/dbs'
import { DL_ATTR, DL_TYPES, DL_LITE_TYPES } from '../data/dls'
import { LB_ATTR, LB_TYPES, LB_LITE_TYPES } from '../data/lbs'
import { OL_ATTR, OL_TYPES, OL_LITE_TYPES } from '../data/ols'
import { K_ATTR, K_TYPES } from '../data/ks'
import { LEGEND_TYPES } from '../data/qb-legends'
import { BUCKET_ATTR } from '../data/nba-attrs'
import { GUARD_TYPES } from '../data/nba-guards'
import { BIG_TYPES } from '../data/nba-bigs'
import { valToGrade } from '../utils/simulation'
import { IconClose, IconCaret } from './app/icons'
import { spectrumColor } from '../lib/gradeColors'

const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']

const RB_ATTR = {
  speed:       { label: 'Speed' },
  burst:       { label: 'Burst' },
  strength:    { label: 'Strength' },
  size:        { label: 'Size' },
  balance:     { label: 'Balance' },
  elusiveness: { label: 'Elusiveness' },
  vision:      { label: 'Vision' },
  hands:       { label: 'Hands' },
  carrying:    { label: 'Carrying' },
}

// Custom Ratings (Sandbox): edit any player's grades. `poolCurrent` and
// `poolLegends` are the two pools behind the Current / All-Time toggle, which
// starts on the mode you're playing; `pool` alone (no legends) hides the toggle.
// Edits made under All-Time save under that mode's key (qb_legends, rb_legends),
// so each mode's spins pick up its own overrides.
// Soccer: `isSoccer` with its own `attrMap` (the striker's traits) and `eraLabels` for the toggle
// (Top Divisions / World Cup); each pool's edits save under their own key
export default function CustomRatingsModal({ isRB, isWR = false, isTE = false, isDB = false, isDL = false, isLB = false, isOL = false, isK = false, isBucket = false, isSoccer = false, attrMap: attrMapProp = null, eraLabels = null, bucketPosition = 'guard', gameMode, pool, poolCurrent = null, poolLegends = null, build = {}, buildTypes: _buildTypesProp, onClose, onSave, onAddToBuild, onAddAllToBuild, noPicks = false, storageKey: storageKeyProp = null, ratingsKeyFor = null }) {
  // (storageKey: a mode's own ratings, College Football's: bap_cfb_custom_ratings)
  const storageKey = storageKeyProp ?? (isSoccer ? 'bas_soccer_custom_ratings' : isBucket ? 'bab_bucket_custom_ratings' : 'bap_custom_ratings')
  const hasToggle = !!(poolLegends && poolLegends.length)
  // (the pool he was last looking at comes back: Current or All-Time, kept per sandbox on this device. The owner, 2026-11-13)
  const eraKey = `bap_cr_era:${storageKey}`
  const [era, setEraState] = useState(() => {
    if (!hasToggle) return 'classic'
    try { const v = localStorage.getItem(eraKey); if (v === 'all-time' || v === 'classic') return v } catch { /* private mode */ }
    return gameMode === 'all-time' ? 'all-time' : 'classic'
  })
  const setEra = v => { setEraState(v); try { localStorage.setItem(eraKey, v) } catch { /* private mode */ } }
  // (ratingsKeyFor(era): a sport's own keys, baseball's 'baseball_bat' / 'baseball_pit_legends': BaseballApp)
  const keyFor = e => ratingsKeyFor ? ratingsKeyFor(e) : isSoccer
    ? `soccer_st${e === 'all-time' ? '_wc' : ''}`
    : isBucket
    ? `bucket_${bucketPosition}`
    : isK ? 'k' : isOL ? 'ol' : isDL ? 'dl' : isLB ? 'lb' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : `${isRB ? 'rb' : 'qb'}${e === 'all-time' ? '_legends' : ''}`
  const modeKey = keyFor(hasToggle ? era : (gameMode === 'all-time' ? 'all-time' : 'classic'))
  const list = hasToggle ? (era === 'all-time' ? poolLegends : (poolCurrent || pool)) : (poolCurrent || pool)
  const attrMeta = attrMapProp ? attrMapProp : isBucket ? BUCKET_ATTR : isK ? K_ATTR : isOL ? OL_ATTR : isDL ? DL_ATTR : isLB ? LB_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR
  const buildTypes = (_buildTypesProp && _buildTypesProp.length > 0)
    ? _buildTypesProp
    : isBucket ? (bucketPosition === 'big' ? BIG_TYPES : GUARD_TYPES)
    : isK ? K_TYPES
    : isOL ? (gameMode === 'lite' ? OL_LITE_TYPES : OL_TYPES)
    : isDL ? (gameMode === 'lite' ? DL_LITE_TYPES : DL_TYPES)
    : isLB ? (gameMode === 'lite' ? LB_LITE_TYPES : LB_TYPES)
    : isDB ? (gameMode === 'lite' ? DB_LITE_TYPES : DB_TYPES)
    : isTE ? (gameMode === 'lite' ? TE_LITE_TYPES : TE_TYPES)
    : isWR ? (gameMode === 'lite' ? WR_LITE_TYPES : WR_TYPES)
    : gameMode === 'lite' ? (isRB ? RB_LITE_TYPES : LITE_TYPES)
    : (gameMode === 'all-time' && !isRB) ? LEGEND_TYPES
    : (isRB ? RB_TYPES : TYPES)
  const attrKeys = buildTypes

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const [search, setSearch] = useState('')
  // every mode's overrides, so switching the toggle never loses unsaved edits
  const [allOverrides, setAllOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
  })
  const overrides = allOverrides[modeKey] || {}
  const setOverrides = updater => setAllOverrides(prev => ({ ...prev, [modeKey]: typeof updater === 'function' ? updater(prev[modeKey] || {}) : updater }))

  const [expandedKey, setExpandedKey] = useState(null)
  const [slotPickerPlayer, setSlotPickerPlayer] = useState(null)
  const [selAttr, setSelAttr] = useState(null)   // the grade being changed (its picker open under the grid)
  const [editedOnly, setEditedOnly] = useState(false)   // the "N edited" tag in the header: only the players he's changed
  const listRef = useRef(null)
  // a player opened low in the list scrolls up so his grades are in view (they used to open under the bottom edge)
  useEffect(() => {
    setSelAttr(null)
    if (!expandedKey) return
    const row = listRef.current?.querySelector('.cr-row.is-open')
    if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }, [expandedKey])

  const q = search.trim().toLowerCase()
  const filtered = list.filter(p =>
    (!editedOnly || overrides[`${p.name}|${p.team}`]) && (
    q === '' ||
    p.name.toLowerCase().includes(q) ||
    (p.team || '').toLowerCase().includes(q))
  )

  const getVal = (key, attr, baseVal) => overrides[key]?.[attr] ?? baseVal
  const getGrade = (key, attr, baseVal) => valToGrade(getVal(key, attr, baseVal))

  const setVal = (playerKey, attr, val) => {
    setOverrides(prev => ({
      ...prev,
      [playerKey]: { ...(prev[playerKey] || {}), [attr]: Math.max(0, Math.min(11, Number(val))) },
    }))
  }

  const resetPlayer = (playerKey) => {
    setOverrides(prev => { const n = { ...prev }; delete n[playerKey]; return n })
  }

  const handleSave = () => {
    let all = {}
    try { all = JSON.parse(localStorage.getItem(storageKey) || '{}') } catch {}
    all = { ...all, ...allOverrides }
    localStorage.setItem(storageKey, JSON.stringify(all))
    onSave(all)
    onClose()
  }
  // closing keeps the edits (the X and a tap outside used to throw them away: only Save kept them)
  const close = handleSave

  const modifiedCount = Object.keys(overrides).length
  useEffect(() => { if (!modifiedCount) setEditedOnly(false) }, [modifiedCount])

  return (
    <div className="cr-overlay" onClick={e => e.target === e.currentTarget && close()}>
      <div className="cr-modal">
        <div className="cr-header">
          <span className="cr-title">Custom Ratings</span>
          {modifiedCount > 0 && <button className={`cr-mod-count${editedOnly ? ' is-on' : ''}`} aria-pressed={editedOnly} onClick={() => setEditedOnly(v => !v)}>{modifiedCount} EDITED{editedOnly ? ' ✕' : ''}</button>}
          {!noPicks && <span className="cr-build-count">{buildTypes.filter(a => build[a]).length}/{buildTypes.length} IN BUILD</span>}
          <button className="cr-close" onClick={close} aria-label="Save and close"><IconClose size={16} /></button>
        </div>

        <div className="cr-search-wrap">
          {hasToggle && (
            <div className="cr-era" role="tablist" aria-label="Player pool">
              <button role="tab" aria-selected={era === 'classic'} className={`cr-era-btn${era === 'classic' ? ' is-on' : ''}`} onClick={() => { setEra('classic'); setExpandedKey(null); setSlotPickerPlayer(null) }}>{eraLabels?.[0] ?? 'Current'}</button>
              <button role="tab" aria-selected={era === 'all-time'} className={`cr-era-btn${era === 'all-time' ? ' is-on' : ''}`} onClick={() => { setEra('all-time'); setExpandedKey(null); setSlotPickerPlayer(null) }}>{eraLabels?.[1] ?? 'All-Time'}</button>
            </div>
          )}
          <div className="cr-search-box">
            <input
              className="cr-search"
              type="search"
              enterKeyHint="search"
              placeholder="Search player or team"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="cr-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><IconClose size={12} /></button>}
          </div>
        </div>

        <div className="cr-list" ref={listRef}>
          {filtered.map(p => {
            const key = `${p.name}|${p.team}`
            const isExpanded = expandedKey === key
            const isModified = !!overrides[key]
            return (
              <div key={key} className={`cr-row${isModified ? ' cr-row-modified' : ''}${isExpanded ? ' is-open' : ''}`}>
                <button className="cr-row-header" onClick={() => setExpandedKey(isExpanded ? null : key)}>
                  <span className="cr-row-name">{p.name}</span>
                  <span className="cr-row-team">{p.team}{p.years ? ` · ${p.years}` : ''}</span>
                  {isModified && <span className="cr-mod-dot" />}
                  <span className="cr-row-chevron"><IconCaret dir={isExpanded ? 'up' : 'down'} size={12} /></span>
                </button>
                {isExpanded && (
                  <div className="cr-attrs">
                    {/* every grade at a glance: tap one, then tap the grade it should be (two taps for any grade, the owner 11-13:
                        the slider rows were tedious) */}
                    <div className="cr-grid">
                      {attrKeys.map(attr => {
                        const baseVal = p.attrs?.[attr] ?? 5
                        const currentVal = getVal(key, attr, baseVal)
                        const isOverridden = overrides[key]?.[attr] !== undefined
                        const his = !noPicks && build[attr]?.qbFull === p.name
                        return (
                          <button key={attr} className={`cr-tile${selAttr === attr ? ' is-sel' : ''}${isOverridden ? ' is-mod' : ''}${his ? ' is-his' : ''}`}
                            style={{ '--g': spectrumColor(currentVal) }} onClick={() => setSelAttr(selAttr === attr ? null : attr)}>
                            <span className="cr-tile-lbl">{attrMeta[attr]?.label || attrMeta[attr]?.shortLabel || attr}</span>
                            <span className="cr-tile-g">{valToGrade(currentVal)}</span>
                          </button>
                        )
                      })}
                    </div>
                    {selAttr && attrKeys.includes(selAttr) && (() => {
                      const attr = selAttr
                      const baseVal = p.attrs?.[attr] ?? 5
                      const currentVal = getVal(key, attr, baseVal)
                      const isOverridden = overrides[key]?.[attr] !== undefined
                      const label = attrMeta[attr]?.label || attrMeta[attr]?.shortLabel || attr
                      return (
                        <div className="cr-gp">
                          <div className="cr-gp-hd">
                            <span className="cr-gp-lbl">{label}</span>
                            {isOverridden && <button className="cr-gp-undo" onClick={() => setOverrides(prev => { const n = { ...(prev[key] || {}) }; delete n[attr]; const all = { ...prev }; if (Object.keys(n).length) all[key] = n; else delete all[key]; return all })}>BACK TO {valToGrade(baseVal)}</button>}
                            {!noPicks && (build[attr]
                              ? <span className={`cr-attr-add is-in${build[attr].qbFull === p.name ? ' is-his' : ''}`}>{build[attr].qbFull === p.name ? 'IN BUILD' : 'SLOT FULL'}</span>
                              : <button className="cr-attr-add" onClick={() => onAddToBuild?.(p, overrides[key], attr)}>ADD TO BUILD</button>)}
                          </div>
                          <div className="cr-gp-grades">
                            {GRADES.map((g, v) => (
                              <button key={g} className={`cr-gp-g${v === Math.round(currentVal) ? ' is-on' : ''}${v === Math.round(baseVal) ? ' is-base' : ''}`} style={{ '--g': spectrumColor(v) }}
                                onClick={() => setVal(key, attr, v)}>{g}</button>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    <div className="cr-quick-btns">
                      <button className="cr-quick-btn cr-quick-f" onClick={() => {
                        const cur = overrides[key] || {}
                        const next = {}
                        attrKeys.forEach(a => { next[a] = Math.max(0, (cur[a] ?? p.attrs?.[a] ?? 5) - 1) })
                        setOverrides(prev => ({ ...prev, [key]: next }))
                      }}>−</button>
                      <button className="cr-quick-btn cr-quick-s" onClick={() => {
                        const cur = overrides[key] || {}
                        const next = {}
                        attrKeys.forEach(a => { next[a] = Math.min(11, (cur[a] ?? p.attrs?.[a] ?? 5) + 1) })
                        setOverrides(prev => ({ ...prev, [key]: next }))
                      }}>+</button>
                      {isModified && (
                        <button className="cr-reset-player" onClick={() => resetPlayer(key)}>
                          Reset
                        </button>
                      )}
                      {/* Starters Only: the wheel fills the build, nobody is hand-picked */}
                      {!noPicks && buildTypes.some(a => !build[a]) && <button className="cr-add-build-btn" onClick={() => onAddAllToBuild?.(p, overrides[key])}>
                        Add all open slots
                      </button>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="cr-empty">{editedOnly && !q ? 'No edited players here.' : 'No players found.'}</div>
          )}
        </div>

        <div className="cr-footer">
          {slotPickerPlayer ? (
            <>
              <span className="cr-slot-label">Pick slot for <strong>{slotPickerPlayer.name}</strong>:</span>
              <div className="cr-slot-picker">
                {buildTypes.filter(attr => !build[attr]).map(attr => (
                  <button key={attr} className="cr-slot-btn" onClick={() => {
                    const k = `${slotPickerPlayer.name}|${slotPickerPlayer.team}`
                    onAddToBuild?.(slotPickerPlayer, overrides[k], attr)
                    setSlotPickerPlayer(null)
                  }}>
                    {attrMeta[attr]?.label || attrMeta[attr]?.shortLabel || attr}
                  </button>
                ))}
              </div>
              <div className="cr-slot-actions">
                <button className="cr-add-all-btn" onClick={() => {
                  const k = `${slotPickerPlayer.name}|${slotPickerPlayer.team}`
                  onAddAllToBuild?.(slotPickerPlayer, overrides[k])
                }}>Add All</button>
                <button className="cr-slot-cancel" onClick={() => setSlotPickerPlayer(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <button className="cr-quick-btn cr-quick-f" onClick={() => {
                setOverrides(prev => {
                  const next = {}
                  list.forEach(p => {
                    const k = `${p.name}|${p.team}`
                    const cur = prev[k] || {}
                    next[k] = {}
                    attrKeys.forEach(a => { next[k][a] = Math.max(0, (cur[a] ?? p.attrs?.[a] ?? 5) - 1) })
                  })
                  return next
                })
              }}>All −</button>
              <button className="cr-quick-btn cr-quick-s" onClick={() => {
                setOverrides(prev => {
                  const next = {}
                  list.forEach(p => {
                    const k = `${p.name}|${p.team}`
                    const cur = prev[k] || {}
                    next[k] = {}
                    attrKeys.forEach(a => { next[k][a] = Math.min(11, (cur[a] ?? p.attrs?.[a] ?? 5) + 1) })
                  })
                  return next
                })
              }}>All +</button>
              {modifiedCount > 0 && (
                <button className="cr-reset-all" onClick={() => setOverrides({})}>Reset all</button>
              )}
              <button className="cr-save" onClick={handleSave}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
