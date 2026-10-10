import { registerPlugin } from '@capacitor/core'
import { IS_APP, APP_PLATFORM } from './platform'

// "Watch a video for coins": one rewarded video ad. Resolves 'rewarded' (watched
// to the end), 'closed' (skipped) or 'unavailable' (no ad / not set up).
//   app     → AdMob through @capacitor-community/admob's native plugin. Until
//             that plugin is installed (and VITE_ADMOB_REWARDED_IOS /
//             _ANDROID are set) the call just reports 'unavailable'.
//   website → a Google Ad Manager rewarded slot (VITE_REWARDED_AD_UNIT).
const AD_UNIT_WEB = import.meta.env.VITE_REWARDED_AD_UNIT || ''
const AD_UNIT_APP = APP_PLATFORM === 'ios' ? import.meta.env.VITE_ADMOB_REWARDED_IOS : import.meta.env.VITE_ADMOB_REWARDED_ANDROID

export const rewardedReady = () => !!(IS_APP ? AD_UNIT_APP : AD_UNIT_WEB)

export function showRewarded() {
  if (!rewardedReady()) return Promise.resolve('unavailable')
  return IS_APP ? appRewarded() : webRewarded()
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

function loadGpt() {
  window.googletag = window.googletag || { cmd: [] }
  if (window.googletag.apiReady || document.querySelector('script[src*="gpt.js"]')) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    s.async = true; s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}
async function webRewarded() {
  try { await loadGpt() } catch { return 'unavailable' }
  return new Promise(resolve => {
    const g = window.googletag
    let settled = false
    const end = (r, slot) => { if (settled) return; settled = true; try { if (slot) g.destroySlots([slot]) } catch {} resolve(r) }
    // no ad within 12s: give up
    const timer = setTimeout(() => end('unavailable'), 12000)
    g.cmd.push(() => {
      const slot = g.defineOutOfPageSlot(AD_UNIT_WEB, g.enums.OutOfPageFormat.REWARDED)
      if (!slot) { clearTimeout(timer); end('unavailable'); return }
      slot.addService(g.pubads())
      let granted = false
      const pub = g.pubads()
      pub.addEventListener('rewardedSlotReady', e => { if (e.slot === slot) { clearTimeout(timer); e.makeRewardedVisible() } })
      pub.addEventListener('rewardedSlotGranted', e => { if (e.slot === slot) granted = true })
      pub.addEventListener('rewardedSlotClosed', e => { if (e.slot === slot) end(granted ? 'rewarded' : 'closed', slot) })
      pub.addEventListener('slotRenderEnded', e => { if (e.slot === slot && e.isEmpty) { clearTimeout(timer); end('unavailable', slot) } })
      g.enableServices()
      g.display(slot)
    })
  })
}
