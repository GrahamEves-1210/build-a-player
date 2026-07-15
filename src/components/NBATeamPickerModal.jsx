import { useEffect } from 'react'
import { NBA_TEAMS } from '../data/nba-players'

const EAST_ORDER = ['BOS','NYK','CLE','MIL','IND','MIA','PHI','ORL','ATL','CHI','BKN','TOR','CHA','DET','WAS']
const WEST_ORDER = ['OKC','DEN','MIN','GSW','DAL','HOU','SAC','PHX','LAC','LAL','NOP','MEM','SAS','POR','UTA']

const TEAM_MAP = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))

function TeamBtn({ t, onSelect }) {
  return (
    <button className="nba-tpk-team" onClick={() => onSelect(t)}>
      <span className="nba-tpk-swatch" style={{ background: t.color }} />
      <span className="nba-tpk-short">{t.short}</span>
      <span className="nba-tpk-name">{t.name.replace(/(.*) (.+)$/, '$2')}</span>
    </button>
  )
}

export default function NBATeamPickerModal({ onSelect, onClose }) {
  const east = EAST_ORDER.map(s => TEAM_MAP[s]).filter(Boolean)
  const west = WEST_ORDER.map(s => TEAM_MAP[s]).filter(Boolean)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="nba-tpk-backdrop" onClick={onClose}>
      <div className="nba-tpk-modal" onClick={e => e.stopPropagation()}>
        <div className="nba-tpk-header">
          <span className="nba-tpk-title">Choose Your Team</span>
          <button className="nba-tpk-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="nba-tpk-body">
          <div className="nba-tpk-conf">
            <div className="nba-tpk-conf-label">EASTERN</div>
            <div className="nba-tpk-list">
              {east.map(t => <TeamBtn key={t.short} t={t} onSelect={onSelect} />)}
            </div>
          </div>
          <div className="nba-tpk-divider" />
          <div className="nba-tpk-conf">
            <div className="nba-tpk-conf-label">WESTERN</div>
            <div className="nba-tpk-list">
              {west.map(t => <TeamBtn key={t.short} t={t} onSelect={onSelect} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
