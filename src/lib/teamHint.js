import { APP_ART } from './platform'

// A screen that shows a man under a team other than the one the jersey index has him on (Depth Chart's career pools:
// Tua under MIA while the index has his 2026 club, ATL) tells the app art which team's jersey to draw (owner 11-25:
// the jersey matches the team the row says). Only where the app art runs; the website's photo address is untouched.
export const teamHint = (src, team) => (APP_ART && src && team && !String(src).startsWith('data:') ? `${src}${String(src).includes('?') ? '&' : '?'}team=${team}` : src)
