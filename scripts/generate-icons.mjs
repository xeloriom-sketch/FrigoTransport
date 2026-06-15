// Générer les icônes PNG pour la PWA
// Exécuter : node scripts/generate-icons.mjs
// Nécessite : npm install -D sharp

import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(__dirname, '../public/icon.svg'))

await sharp(svg).resize(192, 192).png().toFile(join(__dirname, '../public/icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(join(__dirname, '../public/icon-512.png'))
console.log('✅ Icônes générées : icon-192.png et icon-512.png')
