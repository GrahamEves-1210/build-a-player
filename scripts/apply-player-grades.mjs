// Lower all non-jumpShot attrs for non-starters by 1 (min 1)
import { readFileSync, writeFileSync } from 'fs'

let src = readFileSync('./src/data/nba-players.js', 'utf8')

src = src.replace(
  /(\{ name: "[^"]+", short: "[^"]+", team: '[^']+', starter: false, captain: false,\n\s+attrs: \{)([^}]+)(\} \})/g,
  (match, pre, attrsStr, post) => {
    const updated = attrsStr.replace(/\b(\w+):(\d+)/g, (m, key, val) => {
      if (key === 'jumpShot') return m
      return `${key}:${Math.max(1, parseInt(val) - 1)}`
    })
    return pre + updated + post
  }
)

writeFileSync('./src/data/nba-players.js', src, 'utf8')
console.log('done')
