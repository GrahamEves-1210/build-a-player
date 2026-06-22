import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function convert(val) {
  if (val >= 95) return 10
  if (val >= 91) return 9
  if (val >= 87) return 8
  if (val >= 83) return 7
  if (val >= 79) return 6
  if (val >= 75) return 5
  if (val >= 71) return 4
  if (val >= 67) return 3
  if (val >= 63) return 2
  if (val >= 59) return 1
  return 0
}

const filePath = path.join(__dirname, '..', 'src', 'data', 'qbs.js')
let src = fs.readFileSync(filePath, 'utf8')

// Only replace values for the 8 QB attribute keys
src = src.replace(
  /'(arm-strength|mobility|strength|football-iq|leadership|composure|accuracy|pocket-presence)': (\d+)/g,
  (_, key, num) => `'${key}': ${convert(parseInt(num))}`
)

fs.writeFileSync(filePath, src)
console.log('Done — all QB attrs converted to 0–10 scale')
