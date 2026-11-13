// ── BT_LIVE: the one switch for Blacktop Live, the real-time prototype of Blacktop ─────────────────
// (the brief: F:/bap-agents/btlive/DESIGN.md; the game: src/lib/btlive; the screen: src/components/btlive)
// false: nothing about it renders anywhere and nothing of it is downloaded. Today's Blacktop is untouched.
// On the dev server only, ?btlive=1 in the address turns it on for testing, and it sticks on this browser
// (until ?btlive=0), so it survives refreshes and moving between pages. It is always off in the production build.
// (its own tiny file, like lib/kLive.js, so a screen can read it without loading the game)
const BT_DEV = (() => {
  if (typeof location === 'undefined' || !import.meta.env?.DEV) return false
  try {
    if (/[?&]btlive=1\b/.test(location.search)) localStorage.setItem('bap_btlive_dev', '1')
    if (/[?&]btlive=0\b/.test(location.search)) localStorage.removeItem('bap_btlive_dev')
    return localStorage.getItem('bap_btlive_dev') === '1'
  } catch { return /[?&]btlive=1\b/.test(location.search) }
})()
export const BT_LIVE = false || BT_DEV
// The practice page itself opens only on an address that asks for it (/bucket?btlive=1), so the switch being on
// from an earlier visit never takes the rest of the site away. Dev server only.
export const BT_LIVE_OPEN = BT_LIVE && typeof location !== 'undefined' && /[?&]btlive=1\b/.test(location.search)
