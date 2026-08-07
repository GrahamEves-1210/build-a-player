import { useState, useEffect } from 'react'
import { ATTR, TYPES, LITE_TYPES } from '../data/qbs'
import { RB_TYPES, RB_LITE_TYPES } from '../data/rbs'
import { WR_TYPES, WR_LITE_TYPES, WR_ATTR } from '../data/wrs'
import { LEGEND_TYPES } from '../data/legends'
import { BUCKET_ATTR, GUARD_TYPES, BIG_TYPES } from '../data/nba-players'
import { valToGrade } from '../utils/simulation'

const GRADE_COLOR = {
  S: '#c084fc', 'A+': '#34d399', A: '#34d399', 'A-': '#34d399',
  'B+': '#86efac', B: '#86efac', 'B-': '#86efac',
  'C+': '#fde68a', C: '#fde68a', 'C-': '#fde68a',
  D: '#fdba74', F: '#f87171',
}

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

export default function CustomRatingsModal({ isRB, isWR = false, isBucket = false, bucketPosition = 'guard', gameMode, pool, build = {}, buildTypes: _buildTypesProp, onClose, onSave, onAddToBuild, onAddAllToBuild }) {
  const storageKey = isBucket ? 'bab_bucket_custom_ratings' : 'bap_custom_ratings'
  const modeKey = isBucket
    ? `bucket_${bucketPosition}`
    : isWR ? 'wr' : `${isRB ? 'rb' : 'qb'}${gameMode === 'all-time' ? '_legends' : ''}`
  const attrMeta = isBucket ? BUCKET_ATTR : isWR ? WR_ATTR : ATTR
  const buildTypes = (_buildTypesProp && _buildTypesProp.length > 0)
    ? _buildTypesProp
    : isBucket ? (bucketPosition === 'big' ? BIG_TYPES : GUARD_TYPES)
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
  const [overrides, setOverrides] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return saved[modeKey] || {}
    } catch { return {} }
  })

  const [expandedKey, setExpandedKey] = useState(null)
  const [slotPickerPlayer, setSlotPickerPlayer] = useState(null)

  const filtered = pool.filter(p =>
    search === '' ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.team || '').toLowerCase().includes(search.toLowerCase())
  )

  const getVal = (key, attr, baseVal) => overrides[key]?.[attr] ?? baseVal
  const getGrade = (key, attr, baseVal) => valToGrade(getVal(key, attr, baseVal))

  const setVal = (playerKey, attr, val) => {
    setOverrides(prev => ({
      ...prev,
      [playerKey]: { ...(prev[playerKey] || {}), [attr]: Number(val) },
    }))
  }

  const resetPlayer = (playerKey) => {
    setOverrides(prev => { const n = { ...prev }; delete n[playerKey]; return n })
  }

  const handleSave = () => {
    let all = {}
    try { all = JSON.parse(localStorage.getItem(storageKey) || '{}') } catch {}
    all[modeKey] = overrides
    localStorage.setItem(storageKey, JSON.stringify(all))
    onSave(all)
    onClose()
  }

  const modifiedCount = Object.keys(overrides).length

  return (
    <div className="cr-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cr-modal">
        <div className="cr-header">
          <span className="cr-title">Custom Ratings</span>
          {modifiedCount > 0 && <span className="cr-mod-count">{modifiedCount} modified</span>}
          <button className="cr-close" onClick={onClose}>✕</button>
        </div>

        <div className="cr-search-wrap">
          <input
            className="cr-search"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="cr-list">
          {filtered.map(p => {
            const key = `${p.name}|${p.team}`
            const isExpanded = expandedKey === key
            const isModified = !!overrides[key]
            return (
              <div key={key} className={`cr-row${isModified ? ' cr-row-modified' : ''}`}>
                <button className="cr-row-header" onClick={() => setExpandedKey(isExpanded ? null : key)}>
                  <span className="cr-row-name">{p.name}</span>
                  <span className="cr-row-team">{p.team}</span>
                  {isModified && <span className="cr-mod-dot" />}
                  <span className="cr-row-chevron">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="cr-attrs">
                    {attrKeys.map(attr => {
                      const baseVal = p.attrs?.[attr] ?? 5
                      const currentVal = getVal(key, attr, baseVal)
                      const isOverridden = overrides[key]?.[attr] !== undefined
                      return (
                        <div key={attr} className="cr-attr-row">
                          <span className={`cr-attr-label${isOverridden ? ' cr-attr-modified' : ''}`}>
                            {attrMeta[attr]?.label || attrMeta[attr]?.shortLabel || attr}
                          </span>
                          <input
                            type="range" min="0" max="11"
                            value={currentVal}
                            onChange={e => setVal(key, attr, e.target.value)}
                            className="cr-slider"
                            onTouchStart={e => e.stopPropagation()}
                          />
                          <span
                            className="cr-attr-val"
                            style={{ color: GRADE_COLOR[getGrade(key, attr, baseVal)] }}
                          >
                            {getGrade(key, attr, baseVal)}
                          </span>
                        </div>
                      )
                    })}
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
                      <button className="cr-add-build-btn" onClick={() => setSlotPickerPlayer(slotPickerPlayer?.name === p.name ? null : p)}>
                        Add to build
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="cr-empty">No players found.</div>
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
                  pool.forEach(p => {
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
                  pool.forEach(p => {
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
              <button className="cr-save" onClick={handleSave}>Save</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
