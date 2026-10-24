/*
 * Renders the sample-data portal previews to the images the public partner pages use.
 *
 *   Source   src/app/dev-preview/marketing/* entries in src/app/dev-preview/_mockups/registry.tsx
 *            (marketing-org.tsx, marketing-employer.tsx, marketing-recruiter.tsx,
 *            marketing-coach.tsx). Every person, company and number in them is invented.
 *   Output   public/marketing/<name>.webp at 1440 px wide (PNG if sharp is not installed), plus
 *            src/lib/marketing/screenshots.generated.json with each image's width and height, which
 *            src/lib/marketing/screenshots.ts reads so next/image knows the size.
 *
 * How to rerun (after changing a preview):
 *   1. In one terminal:  npx next dev -p 3100
 *        The first run can print an upgrade notice and exit. Ignore it and run the command again.
 *        If Turbopack complains about node_modules, use:  npx next dev --webpack -p 3100
 *   2. In another terminal, once the server is up (the first compile takes 60 to 120 seconds):
 *        node scripts/marketing/render-screenshots.mjs
 *      Render only some:  node scripts/marketing/render-screenshots.mjs hiring-dashboard recruiter-search
 *      Another server:    BASE_URL=http://localhost:3000 node scripts/marketing/render-screenshots.mjs
 *      Another browser:   CHROMIUM_PATH=/path/to/chrome node scripts/marketing/render-screenshots.mjs
 *   3. Stop the dev server by its port (never pkill -f):  kill $(lsof -ti tcp:3100)
 *   4. Look at the images in public/marketing/ and commit them with the JSON file.
 *
 * Needs: playwright (a devDependency) and a Chromium. /opt/pw-browsers/chromium is used when present.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = join(ROOT, 'public', 'marketing')
const MANIFEST = join(ROOT, 'src', 'lib', 'marketing', 'screenshots.generated.json')
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
const WIDTH = 1440
// Pages with no fixed frame (the coach previews) are cropped to this height so the image stays readable.
const MAX_FRAMELESS_HEIGHT = 1500

// name -> path under /dev-preview. Names are the files in public/marketing/.
export const SHOTS = {
  'higher-education-admin-overview': 'marketing/higher-education-admin-overview',
  'higher-education-alumni-workspace': 'marketing/higher-education-alumni-workspace',
  'higher-education-career-caseload': 'marketing/higher-education-career-caseload',
  'workforce-admin-overview': 'marketing/workforce-admin-overview',
  'workforce-hub-dashboard': 'marketing/workforce-hub-dashboard',
  'workforce-hub-layoffs': 'marketing/workforce-hub-layoffs',
  'hiring-dashboard': 'marketing/hiring-dashboard',
  'hiring-evidence-brief': 'marketing/hiring-evidence-brief',
  'hiring-roles': 'marketing/hiring-roles',
  'employees-learning': 'marketing/employees-learning',
  'employees-retention': 'marketing/employees-retention',
  'employees-enroll': 'marketing/employees-enroll',
  'outplacement-reporting': 'marketing/outplacement-reporting',
  'outplacement-roster': 'marketing/outplacement-roster',
  'outplacement-compliance': 'marketing/outplacement-compliance',
  'recruiter-submission-packet': 'marketing/recruiter-submission-packet',
  'recruiter-search': 'marketing/recruiter-search',
  'recruiter-pipeline': 'marketing/recruiter-pipeline',
  'coach-clients': 'marketing/coach-clients',
  'coach-pre-session-brief': 'marketing/coach-pre-session-brief',
  'coach-session-log': 'marketing/coach-session-log',
}

const { chromium } = await import('playwright')
let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('sharp is not installed: writing PNG instead of WebP.')
}

const chromePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const only = process.argv.slice(2)
const names = only.length ? only : Object.keys(SHOTS)
const unknown = names.filter((n) => !SHOTS[n])
if (unknown.length) {
  console.error(`Unknown name(s): ${unknown.join(', ')}. Known: ${Object.keys(SHOTS).join(', ')}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
const page = await ctx.newPage()
let failed = 0

for (const name of names) {
  const url = `${BASE_URL}/dev-preview/${SHOTS[name]}`
  try {
    // The first request compiles the page, so allow a long wait.
    await page.goto(url, { waitUntil: 'load', timeout: 180_000 })
    await page.evaluate(() => document.fonts.ready)
    // Next's dev-mode indicator must not end up in the image.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    const frame = page.locator('[data-shot]').first()
    const framed = (await frame.count()) > 0
    const png = framed
      ? await frame.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', fullPage: true })
    let out
    let ext
    if (sharp) {
      let img = sharp(png)
      const meta = await img.metadata()
      if (!framed && meta.height && meta.height > MAX_FRAMELESS_HEIGHT) img = img.extract({ left: 0, top: 0, width: meta.width, height: MAX_FRAMELESS_HEIGHT })
      out = await img.webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true })
      ext = 'webp'
      writeFileSync(join(OUT_DIR, `${name}.${ext}`), out.data)
      manifest[name] = { src: `/marketing/${name}.${ext}`, width: out.info.width, height: out.info.height }
      console.log(`${name}.${ext}  ${out.info.width}x${out.info.height}  ${(out.data.length / 1024).toFixed(0)} KB`)
    } else {
      writeFileSync(join(OUT_DIR, `${name}.png`), png)
      const dim = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
      manifest[name] = { src: `/marketing/${name}.png`, width: dim.w, height: dim.h }
      console.log(`${name}.png  ${(png.length / 1024).toFixed(0)} KB`)
    }
  } catch (err) {
    failed += 1
    console.error(`FAILED ${name} (${url}): ${err.message}`)
  }
}

await browser.close()
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`)
if (failed) process.exit(1)
