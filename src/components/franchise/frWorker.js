// FRANCHISE: the engine's heavy one-off work, off the page's thread (frStore.js offThread). The engine is pure JS
// (no DOM), so the same module runs here: the 32 clubs' previews for team select, a new league, an opened save.
//   { id, kind: 'previews', seed }   -> teamPreviews(seed)
//   { id, kind: 'create', opts }     -> createFranchise(opts)
//   { id, kind: 'unpack', text }     -> unpackFranchise(text)
import { teamPreviews, createFranchise, unpackFranchise } from '../../lib/franchise'

self.onmessage = e => {
  const { id, kind } = e.data || {}
  try {
    const out = kind === 'previews' ? teamPreviews(e.data.seed) : kind === 'create' ? createFranchise(e.data.opts) : kind === 'unpack' ? unpackFranchise(e.data.text) : null
    self.postMessage({ id, ok: true, out })
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) })
  }
}
