import sharp from 'sharp'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'

const PUBLIC = 'public'

// Large standalone images — resize + convert to WebP
const TARGETS = [
  // Blurred backgrounds — nobody can tell the difference at 75 quality / 1920px
  { src: 'footballbackground.png', maxW: 1920, quality: 75 },
  { src: 'bucketbackground.png',   maxW: 1920, quality: 75 },
  // Trophy / UI images — keep full size, just encode as WebP
  { src: 'trophy.png',             maxW: 800,  quality: 85 },
  { src: 'trophybasketball.png',   maxW: 800,  quality: 85 },
  // Silhouettes — keep crisp
  { src: 'qb-silhouette.png',      maxW: 800,  quality: 90 },
  { src: 'rbsilhouette.png',       maxW: 800,  quality: 90 },
]

async function convertOne(srcPath, destPath, maxW, quality) {
  const img = sharp(srcPath)
  const meta = await img.metadata()
  const pipeline = meta.width > maxW
    ? img.resize(maxW, null, { withoutEnlargement: true })
    : img
  await pipeline.webp({ quality }).toFile(destPath)
  const srcKB  = Math.round(statSync(srcPath).size  / 1024)
  const destKB = Math.round(statSync(destPath).size / 1024)
  console.log(`  ${basename(srcPath)} → ${basename(destPath)}  ${srcKB} KB → ${destKB} KB  (${Math.round((1 - destKB/srcKB)*100)}% smaller)`)
}

async function convertHeadshots(dir, quality = 75) {
  if (!existsSync(dir)) return
  const files = readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f))
  let converted = 0, skipped = 0
  for (const file of files) {
    const srcPath  = join(dir, file)
    const destPath = join(dir, basename(file, extname(file)) + '.webp')
    if (existsSync(destPath)) { skipped++; continue }
    await sharp(srcPath).webp({ quality }).toFile(destPath)
    converted++
  }
  if (converted > 0) console.log(`  headshots: converted ${converted} new files (${skipped} already done)`)
  else console.log(`  headshots: all ${skipped} already converted`)
}

async function run() {
  console.log('Compressing images...')

  for (const { src, maxW, quality } of TARGETS) {
    const srcPath  = join(PUBLIC, src)
    const destPath = join(PUBLIC, basename(src, extname(src)) + '.webp')
    if (!existsSync(srcPath)) { console.log(`  skipping ${src} (not found)`); continue }
    await convertOne(srcPath, destPath, maxW, quality)
  }

  await convertHeadshots(join(PUBLIC, 'headshots'))
  await convertHeadshots(join(PUBLIC, 'headshots', 'nba'))

  console.log('Done.')
}

run().catch(err => { console.error('Image compression failed:', err); process.exit(1) })
