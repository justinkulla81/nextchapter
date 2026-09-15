/**
 * Reads the layoffs.fyi tracker the way a browser does, and posts the rows to
 * NextChapter.
 *
 * Why a real browser: the tracker is an Airtable shared view whose data call is
 * bound to its own embed client. A hand-built request with the same signed
 * policy and the same headers is refused, so the page is rendered instead and
 * the response it loads for itself is read off the wire. That single response
 * carries the whole table — nothing is paged or scrolled.
 *
 * Run: npx tsx scripts/layoffsfyi/fetch.ts [--dry] [--target https://...]
 */
import { chromium, type Response as PwResponse } from 'playwright'

const EMBED = 'https://airtable.com/embed/app1PaujS9zxVGUZ4/shroKsHx3SdYYOzeh'
const DATA_CALL = 'readSharedViewData'

export interface LayoffRow {
  company: string
  locationHq: string | null
  employees: number | null
  date: string | null
  industry: string | null
  source: string | null
  country: string | null
  stage: string | null
}

/** Airtable returns columns and rows separately; this joins them by id. */
export function normalize(payload: unknown): LayoffRow[] {
  const data = (payload as { data?: Record<string, unknown> }).data ?? (payload as Record<string, unknown>)
  const table = (data.table ?? data) as {
    columns?: { id: string; name: string; type?: string; typeOptions?: { choices?: Record<string, { name?: string }> } }[]
    rows?: unknown[]
  }
  const columns = table.columns ?? []
  const rows = table.rows ?? []

  // Select and multi-select cells hold choice ids ("selMi3Mre9zsq25fJ"), so the
  // column metadata is the only place the readable label exists.
  const choiceNames = new Map<string, string>()
  for (const c of columns) {
    for (const [id, choice] of Object.entries(c.typeOptions?.choices ?? {})) {
      if (choice?.name) choiceNames.set(id, choice.name)
    }
  }

  const byName = new Map<string, string>()
  for (const c of columns) byName.set(c.name.trim().toLowerCase(), c.id)
  const id = (...names: string[]) => names.map((n) => byName.get(n)).find(Boolean)

  const cCompany = id('company')
  const cLocation = id('location hq', 'location')
  const cCount = id('# laid off', 'laid off')
  const cDate = id('date')
  const cIndustry = id('industry')
  const cSource = id('source')
  const cCountry = id('country')
  const cStage = id('stage')
  if (!cCompany) return []

  const text = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') {
      const trimmed = v.trim()
      if (!trimmed) return null
      // A cell may hold one id, or several comma-separated.
      if (/^sel[A-Za-z0-9]+(,\s*sel[A-Za-z0-9]+)*$/.test(trimmed)) {
        const names = trimmed.split(/,\s*/).map((x) => choiceNames.get(x)).filter(Boolean)
        return names.length ? names.join(', ') : null
      }
      return trimmed
    }
    if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ') || null
    if (typeof v === 'object' && 'name' in (v as object)) return text((v as { name: unknown }).name)
    return null
  }

  const out: LayoffRow[] = []
  for (const r of rows as { cellValuesByColumnId?: Record<string, unknown> }[]) {
    const cells = r.cellValuesByColumnId ?? {}
    const company = text(cells[cCompany])
    if (!company) continue
    const rawCount = text(cCount ? cells[cCount] : null)
    const n = rawCount ? parseInt(rawCount.replace(/[^\d]/g, ''), 10) : NaN
    out.push({
      company,
      locationHq: text(cLocation ? cells[cLocation] : null),
      employees: Number.isFinite(n) && n > 0 ? n : null,
      date: text(cDate ? cells[cDate] : null),
      industry: text(cIndustry ? cells[cIndustry] : null),
      source: text(cSource ? cells[cSource] : null),
      country: text(cCountry ? cells[cCountry] : null),
      stage: text(cStage ? cells[cStage] : null),
    })
  }
  return out
}

export async function fetchLayoffRows(timeoutMs = 90_000): Promise<LayoffRow[]> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    })

    // The page asks for its data as msgpack, which is binary. The request is
    // rewritten to drop that flag so the same call comes back as JSON — the
    // browser still makes the request, with its own headers and session; only
    // the response encoding changes.
    await page.route(`**/*${DATA_CALL}*`, async (route) => {
      const url = new URL(route.request().url())
      const raw = url.searchParams.get('stringifiedObjectParams')
      if (raw) {
        try {
          const params = JSON.parse(raw) as Record<string, unknown>
          delete params.allowMsgpackOfResult
          url.searchParams.set('stringifiedObjectParams', JSON.stringify(params))
          await route.continue({ url: url.toString() })
          return
        } catch {
          // Fall through and let the original request go.
        }
      }
      await route.continue()
    })

    // The table arrives in one response; take the largest one seen, because the
    // page also makes smaller metadata calls to the same endpoint.
    let best: LayoffRow[] = []
    let bestRaw: unknown = null
    const seen: Promise<void>[] = []
    page.on('response', (res: PwResponse) => {
      if (!res.url().includes(DATA_CALL) || res.status() !== 200) return
      seen.push(
        res
          .json()
          .then((j) => {
            const rows = normalize(j)
            if (process.env.DEBUG_LAYOFFS) console.error(`  response: ${rows.length} rows parsed`)
            if (rows.length > best.length) { best = rows; bestRaw = j }
          })
          .catch((e) => {
            if (process.env.DEBUG_LAYOFFS) console.error(`  response unparsed: ${String(e).slice(0, 80)}`)
          })
      )
    })

    // 'networkidle' never fires here — Airtable holds connections open — so the
    // data call is waited for directly, then given a moment to finish parsing.
    await page.goto(EMBED, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page
      .waitForResponse((r) => r.url().includes(DATA_CALL) && r.status() === 200, { timeout: timeoutMs })
      .catch(() => undefined)
    await page.waitForTimeout(4_000)
    await Promise.allSettled(seen)
    if (process.env.DUMP_RAW && bestRaw) {
      const fs = await import('fs')
      fs.writeFileSync(process.env.DUMP_RAW, JSON.stringify(bestRaw))
      console.error(`raw payload written to ${process.env.DUMP_RAW}`)
    }
    return best
  } finally {
    await browser.close()
  }
}

/** Rows older than this are not worth posting; the server drops them anyway. */
const MAX_AGE_DAYS = 540
const CHUNK = 120

async function post(target: string, body: unknown): Promise<Record<string, number>> {
  const res = await fetch(`${target.replace(/\/$/, '')}/api/admin/warn/import-layoffs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(280_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text) as Record<string, number>
}

async function main() {
  const dry = process.argv.includes('--dry')
  const targetArg = process.argv.indexOf('--target')
  const target = targetArg > -1 ? process.argv[targetArg + 1] : process.env.NEXTCHAPTER_URL

  const all = await fetchLayoffRows()
  console.error(`layoffs.fyi: ${all.length} rows read`)
  if (!all.length) {
    console.error('No rows read — the tracker layout or its data call has changed.')
    process.exit(1)
  }

  // Filtering here keeps the payload small; the server applies the same rule.
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
  const rows = all.filter((r) => {
    if (!r.date) return true
    const t = new Date(r.date).getTime()
    return Number.isNaN(t) || t >= cutoff
  })
  console.error(`within the ${MAX_AGE_DAYS}-day window: ${rows.length}`)

  if (dry || !target) {
    console.log(JSON.stringify(rows.slice(0, 5), null, 1))
    console.error(dry ? '(dry run, nothing posted)' : 'No --target/NEXTCHAPTER_URL; nothing posted.')
    return
  }

  // Posted in chunks: one request for the whole table runs past both the
  // client's header timeout and the serverless function limit.
  const totals = { fetched: 0, created: 0, promoted: 0 }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const r = await post(target, { rows: chunk })
    totals.fetched += r.fetched ?? 0
    totals.created += r.created ?? 0
    totals.promoted += r.promoted ?? 0
    console.error(`  chunk ${i / CHUNK + 1}: +${r.created ?? 0} new, +${r.promoted ?? 0} promoted`)
  }

  await post(target, { summary: totals })
  console.error(`done: ${totals.created} new notices, ${totals.promoted} promoted`)
}

if (process.argv[1]?.includes('layoffsfyi')) {
  main().catch((e) => {
    console.error(`layoffs.fyi sync failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
