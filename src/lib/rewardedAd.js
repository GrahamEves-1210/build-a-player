import { registerPlugin } from '@capacitor/core'
import { IS_APP, APP_PLATFORM } from './platform'
import { rampRewardedAdd, rampRewardedDestroy } from './ads'

// "Watch a video for coins": one rewarded video ad. Resolves 'rewarded' (watched
// enough), 'closed' (skipped) or 'unavailable' (no ad / not set up).
//   app     → AdMob through @capacitor-community/admob's native plugin. Until
//             that plugin is installed (and VITE_ADMOB_REWARDED_IOS /
//             _ANDROID are set) the call just reports 'unavailable'.
//   website → Playwire's rewarded unit (rewarded_ad_video) through Ramp, the way
//             Playwire asks: the unit is asked for when the offer comes on screen
//             (openRewarded), the watch button lights up only once it has filled
//             (rewardedAdVideoRewardReady; nothing within NO_FILL_MS is a no-fill),
//             the video plays on the player's tap (manuallyCreateRewardUi with
//             skipConfirmation: our own buttons), the reward goes in the Promise's
//             then (75% watched by default, set on Playwire's side), and the unit and
//             its listeners go when the offer closes.
const AD_UNIT_APP = APP_PLATFORM === 'ios' ? import.meta.env.VITE_ADMOB_REWARDED_IOS : import.meta.env.VITE_ADMOB_REWARDED_ANDROID

// Rewarded videos are switched off everywhere (the respin, revive, retry, streak
// and shop-coins offers) until the ad units are actually live; flip this back on then
export const REWARDED_ON = false

// Playwire's review before go-live: build-a-player.com/?rewarded-test opens the Shop with the video
// offer on, for this browser tab only (lib/deepLinks.js sets it). Add #google_sample_tag=1 to force a
// fill, #google_sample_tag=blank; to force a no-fill.
const TEST_KEY = 'bap_rewarded_test'
export const rewardedTest = () => { try { return !IS_APP && sessionStorage.getItem(TEST_KEY) === '1' } catch { return false } }
// (the address is tidied back to / as the page loads: the dock asks once whether to open the Shop)
let openShop = false
export const setRewardedTest = () => { openShop = true; try { sessionStorage.setItem(TEST_KEY, '1') } catch {} }
export const takeRewardedOpen = () => { const o = openShop; openShop = false; return o }
export const rewardedOn = () => REWARDED_ON || rewardedTest()

export const rewardedReady = () => (IS_APP ? !!AD_UNIT_APP : typeof window !== 'undefined' && !!document.querySelector('script[src*="intergient.com"]'))

// One video for an in-game reward (respin, revive, retry...): { ok } when it was
// watched to the end, else the line to show the player
export async function watchFor() {
  const r = await showRewarded()
  return r === 'rewarded' ? { ok: true } : { ok: false, note: r === 'closed' ? 'Watch to the end to get it.' : 'No video right now. Try again in a bit.' }
}

// In one go, for an offer the player has already tapped (on the website: ask, wait for the fill, play)
export function showRewarded() {
  if (!rewardedReady()) return Promise.resolve('unavailable')
  if (IS_APP) return appRewarded()
  return new Promise(resolve => {
    const ad = openRewarded(state => {
      if (state === 'ready') ad.watch().then(r => { ad.close(); resolve(r) })
      else if (state === 'none') { ad.close(); resolve('unavailable') }
    })
  })
}

let AdMob = null, admobInit = null
async function appRewarded() {
  try {
    AdMob ??= registerPlugin('AdMob')
    admobInit ??= AdMob.initialize({})
    await admobInit
    await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_APP })
    const reward = await AdMob.showRewardVideoAd()
    return reward ? 'rewarded' : 'closed'
  } catch { return 'unavailable' }
}

// ── Website: Playwire's rewarded video ──────────────────────────────────────
const NO_FILL_MS = 6000
// Opens the offer: asks Ramp for the unit and reports its state to onState: 'loading', 'ready' (show the
// watch button), 'none' (no fill: no retry until the offer opens again, as Playwire asks). Returns
// { state, watch(), close() }. watch() plays it: 'rewarded' | 'closed' | 'unavailable'. After a watch Ramp
// fetches the next video itself, so the state goes back to 'loading' until that one is ready.
// close() always: it takes the unit down and removes every listener (stacked ones grant twice).
export function openRewarded(onState) {
  let state = 'loading', closed = false, timer = 0
  const listeners = []
  const on = (ev, fn) => { window.addEventListener(ev, fn); listeners.push([ev, fn]) }
  const set = s => { if (closed || state === s) return; state = s; onState?.(s) }
  const wait = () => { clearTimeout(timer); timer = setTimeout(() => { if (state === 'loading') set('none') }, NO_FILL_MS) }
  on('rewardedAdVideoRewardReady', () => { clearTimeout(timer); set('ready') })
  wait()
  rampRewardedAdd()
  return {
    get state() { return state },
    watch() {
      if (closed || state !== 'ready') return Promise.resolve('unavailable')
      return new Promise(resolve => {
        let done = false
        const end = r => {
          if (done) return
          done = true
          set('loading'); wait()
          resolve(r)
        }
        // closed before the threshold, or turned down: no reward
        on('rewardedCloseButtonTriggered', () => end('closed'))
        on('rejectAdCloseCta', () => end('closed'))
        try {
          window.ramp.manuallyCreateRewardUi({ skipConfirmation: true }).then(() => end('rewarded'), () => end('closed'))
        } catch { end('unavailable') }
      })
    },
    close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      for (const [ev, fn] of listeners) window.removeEventListener(ev, fn)
      rampRewardedDestroy()
    },
  }
}
