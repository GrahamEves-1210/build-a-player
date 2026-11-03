// The live server (live/, a Cloudflare Worker): game rooms over WebSockets, and the
// result checks over HTTPS (lib/submit.js)
export const LIVE_URL = (import.meta.env.VITE_LIVE_URL || 'wss://bap-live.gre56734.workers.dev').replace(/\/$/, '')
export const LIVE_HTTP = LIVE_URL.replace(/^ws/, 'http')
