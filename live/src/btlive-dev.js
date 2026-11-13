// DEV ONLY: the live server as it is (index.js), plus the BLACKTOP LIVE rooms (btlive.js), for testing on this
// machine:  cd live && npx wrangler dev -c wrangler.btlive.toml --port 8787
// wrangler.toml (the real deploy) never loads this file. Shipping the rooms is the owner's call: export BtLiveRoom
// from index.js, route /btlive/room/<CODE> to it the way /room/<CODE> is routed, and add the binding and the v5
// migration from wrangler.btlive.toml to wrangler.toml.
import live from './index.js'
export * from './index.js'
export { BtLiveRoom } from './btlive.js'

const ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url)
    const bl = url.pathname.match(/^\/btlive\/room\/([A-Z0-9]{6})$/)
    if (!bl) return live.fetch(req, env, ctx)
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Blacktop Live room', { status: 426 })
    const o = req.headers.get('Origin')
    if (o && !ORIGIN.test(o)) return new Response('forbidden', { status: 403 })
    return env.BTLIVE_ROOM.get(env.BTLIVE_ROOM.idFromName(bl[1])).fetch(req)
  },
}
