// The clean build's HTML (scripts/clean-flag.mjs): the leagues' marks out of the page's own words (the title, the
// descriptions, the share tags, the structured data and any prerendered text), the same plain words the page's
// script uses (src/lib/termMap.js). Scripts, styles and addresses are left alone.
import { cleanTerms } from '../src/lib/termMap.js'

const WORDS = /\b(content|alt|title|aria-label|placeholder)="([^"]*)"/g
export function cleanHtml(html) {
  return html
    // structured data: every string value
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, body, b) =>
      a + body.replace(/"((?:[^"\\]|\\.)*)"/g, (q, v) => `"${cleanTerms(v)}"`) + b)
    // the words between tags, outside other scripts and styles
    .replace(/(<(script|style)\b[^>]*>[\s\S]*?<\/\2>)|>([^<>]+)</g, (m, keep, tag, text) => (keep ? m : `>${cleanTerms(text)}<`))
    .replace(/<[a-zA-Z][^>]*>/g, tag => (/^<script/i.test(tag) ? tag : tag.replace(WORDS, (m, k, v) => `${k}="${cleanTerms(v)}"`)))
}
