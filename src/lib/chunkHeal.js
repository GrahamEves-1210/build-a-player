// A part of the game that won't load (a deploy replaced the files an open tab asks for, or the browser kept the home
// page in place of one of them: everything under /assets/ is cached for a year, public/_headers, so one bad answer
// during a deploy sticks): fetch the game's files again past the browser's cache, then reload. index.html's boot
// guard does the same when the game never starts; this is for a part that fails once it's running.
//   isChunkError(err)        a failed code download, by its message (each browser words it its own way)
//   healAndReload(err)       refetch and reload, at most once a minute (never a loop); false when it held off
const CHUNK = /dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Loading (CSS )?chunk|ChunkLoadError|reading 'default'|_result\.default|error loading dynamically imported/i
const LAST = 'bap_chunk_reload'

export const isChunkError = err => CHUNK.test(String(err?.message ?? err ?? ''))

export function assetUrls(err) {
  const out = new Set()
  const mine = u => { try { const x = new URL(u, location.href); return x.origin === location.origin && x.pathname.startsWith('/assets/') ? x.href : null } catch { return null } }
  // the file named in the error, then every file the page has loaded from /assets/
  for (const m of String(err?.message ?? err ?? '').match(/https?:\/\/[^\s'")]+/g) ?? []) { const u = mine(m); if (u) out.add(u) }
  try { for (const e of performance.getEntriesByType('resource')) { const u = mine(e.name); if (u) out.add(u) } } catch {}
  for (const el of document.querySelectorAll('script[src], link[href]')) { const u = mine(el.src || el.href); if (u) out.add(u) }
  return [...out]
}

export function healAndReload(err, { force = false } = {}) {
  try {
    if (!force && Date.now() - Number(sessionStorage.getItem(LAST) || 0) < 60000) return false
    sessionStorage.setItem(LAST, String(Date.now()))
  } catch { if (!force) return false }
  const jobs = assetUrls(err).map(u => fetch(u, { cache: 'reload' }).catch(() => {}))
  // never hang on a slow request: reload after 8s either way
  Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 8000))]).then(() => window.location.reload())
  return true
}
