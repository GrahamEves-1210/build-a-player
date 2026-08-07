import { rmSync, existsSync } from 'fs'
if (existsSync('dist/headshots')) rmSync('dist/headshots', { recursive: true, force: true })
