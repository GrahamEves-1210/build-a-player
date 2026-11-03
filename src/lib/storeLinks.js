// Where the app lives in the stores. The App Store ID is the app's "Apple ID"
// in App Store Connect (App Information). Until it's set, the website's
// download badge stays hidden (it would link nowhere).
export const APP_STORE_ID = ''
export const PLAY_PACKAGE = 'com.buildaplayer.app'
export const APP_STORE_URL = APP_STORE_ID ? `https://apps.apple.com/app/build-a-player/id${APP_STORE_ID}` : ''
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`
