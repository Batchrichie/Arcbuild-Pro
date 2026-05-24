/**
 * Generates favicon assets from src/assets/ModuloDevLogo.png
 * Run: node scripts/generate-favicons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const source = path.join(root, 'src', 'assets', 'ModuloDevLogo.png')
const publicDir = path.join(root, 'public')

const sizes = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
}

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Source logo not found:', source)
    process.exit(1)
  }

  fs.mkdirSync(publicDir, { recursive: true })

  const pngBuffers = {}
  for (const [filename, size] of Object.entries(sizes)) {
    const buffer = await sharp(source)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toBuffer()
    fs.writeFileSync(path.join(publicDir, filename), buffer)
    pngBuffers[filename] = buffer
    console.log('Wrote', filename)
  }

  const ico = await toIco([pngBuffers['favicon-16x16.png'], pngBuffers['favicon-32x32.png']])
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico)
  console.log('Wrote favicon.ico')

  const svg32 = pngBuffers['favicon-32x32.png'].toString('base64')
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0b1730"/>
  <image href="data:image/png;base64,${svg32}" width="28" height="28" x="2" y="2"/>
</svg>
`
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)
  console.log('Wrote favicon.svg')

  fs.copyFileSync(source, path.join(publicDir, 'modulo-logo.png'))
  console.log('Synced modulo-logo.png')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
