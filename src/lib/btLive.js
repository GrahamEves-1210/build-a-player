// ── BT_LIVE: the one switch for Blacktop Live, the real-time prototype of Blacktop ─────────────────
// (the brief: F:/bap-agents/btlive/DESIGN.md; the game: src/lib/btlive; the screen: src/components/btlive)
// false: nothing about it renders anywhere and nothing of it is downloaded. Today's Blacktop is untouched.
// On the dev server it's on (the owner, 2026-11-24): Blacktop on Home opens it; ?btlive=0 turns it off on this browser
// (?btlive=1 back on). It is always off in the production build.
// (its own tiny file, like lib/kLive.js, so a screen can read it without loading the game)
const BT_DEV = (() => {
  if (typeof location === 'undefined' || !import.meta.env?.DEV) return false
  try {
    if (/[?&]btlive=1\b/.test(location.search)) localStorage.setItem('bap_btlive_dev', '1')
    if (/[?&]btlive=0\b/.test(location.search)) localStorage.setItem('bap_btlive_dev', '0')
    return localStorage.getItem('bap_btlive_dev') !== '0'
  } catch { return true }
})()
export const BT_LIVE = false || BT_DEV
// The practice page itself opens only on an address that asks for it (/bucket?btlive=1), so the switch being on
// from an earlier visit never takes the rest of the site away. Dev server only.
// (owner 11-26: Blacktop's PRACTICE button opens it, so it's in every build, behind that address)
export const BT_LIVE_OPEN = typeof location !== 'undefined' && /[?&]btlive=1\b/.test(location.search)
