/**
 * Renders the WARN pages that a scripted fetch cannot read, and posts the HTML
 * to NextChapter for parsing.
 *
 * Two kinds of state end up here: those that build their notice list in the
 * browser (Wisconsin), and those that refuse scripted requests outright —
 * mass.gov returns 403 to every non-browser request, its own CSV included.
 *
 * Parsing deliberately happens server-side, so these states use exactly the
 * same column-mapped parser and tests as the ones fetched normally.
 *
 * Run: npx tsx scripts/warn/render-states.ts [--dry] [--target https://...]
 */
import { chromium } from 'playwright'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/** Kept in step with RENDERED_STATES in src/lib/warn/sources.ts. */
const PAGES: Record<string, string> = {
  MA: 'https://www.mass.gov/info-details/worker-adjustment-and-retraining-notification-act-warn-layoff-and-closure-updates',
  WI: 'https://dwd.wisconsin.gov/dislocatedworker/warn/',
}

async function render(state: string, url: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ userAgent: UA })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // These lists are populated after load; there is no reliable signal for
    // "finished", so wait for a table with real rows and fall back to a pause.
    await page
      .waitForFunction(() => [...document.querySelectorAll('table')].some((t) => t.querySelectorAll('tr').length > 3), {
        timeout: 30_000,
      })
      .catch(() => undefined)
    await page.waitForTimeout(3_000)
    const html = await page.content()
    console.error(`${state}: rendered ${html.length} bytes`)
    return html
  } catch (e) {
    console.error(`${state}: render failed — ${e instanceof Error ? e.message.slice(0, 90) : String(e)}`)
    return null
  } finally {
    await browser.close()
  }
}

async function main() {
  const dry = process.argv.includes('--dry')
  const i = process.argv.indexOf('--target')
  const target = i > -1 ? process.argv[i + 1] : process.env.NEXTCHAPTER_URL

  let failures = 0
  for (const [state, url] of Object.entries(PAGES)) {
    const html = await render(state, url)
    if (!html) { failures++; continue }

    if (dry || !target) {
      const tables = (html.match(/<table/gi) ?? []).length
      console.error(`  (dry) ${state}: ${tables} tables in the rendered page`)
      continue
    }

    const res = await fetch(`${target.replace(/\/$/, '')}/api/admin/warn/import-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
      body: JSON.stringify({ state, html }),
      signal: AbortSignal.timeout(280_000),
    })
    const text = await res.text()
    console.error(`  ${state} -> ${res.status} ${text.slice(0, 220)}`)
    if (!res.ok) failures++
  }

  // A state that stops rendering should fail the job loudly rather than look
  // like a quiet week with no layoffs.
  if (failures) process.exit(1)
}

if (process.argv[1]?.includes('render-states')) {
  main().catch((e) => {
    console.error(`render failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
