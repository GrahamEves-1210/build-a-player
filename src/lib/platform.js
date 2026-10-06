import { Capacitor } from '@capacitor/core'

// True inside the iOS/Android app (Capacitor), false on the website.
export const IS_APP = Capacitor.isNativePlatform()
// 'ios' | 'android' | 'web'
export const APP_PLATFORM = Capacitor.getPlatform()

// Plus is sold through Stripe on the website. The App Store and Google Play
// require their own in-app purchase for digital subscriptions, so the app
// doesn't sell Plus (or link to Stripe) until in-app purchase is wired up.
export const CAN_SELL_PLUS = !IS_APP

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1])
  r.onerror = reject
  r.readAsDataURL(blob)
})

// Open the phone's share sheet (text, link and/or an image). The app's WebView
// can't download files and its web share API is unreliable with files, so the
// image is written to the app's cache folder and shared as a file.
// Resolves 'shared' or 'aborted' (user closed the sheet).
export async function shareNative({ title, text, url, blob, filename }) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const files = []
  if (blob) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache })
    files.push(uri)
  }
  try {
    await Share.share({ title, text, url, ...(files.length ? { files } : {}) })
    return 'shared'
  } catch {
    return 'aborted'
  }
}
