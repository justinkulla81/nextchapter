import 'server-only'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { captureServerEvent } from '@/lib/posthog/server'
import { CHANNELS, type ChannelId } from '@/lib/social/channels'
import { jobsReportPost, joltsPost, type JobsReportData, type JoltsData, type MonthPoint, type SocialPost } from '@/lib/social/posts'

const STATE_PATH = 'social/bls-posted.json.gz'

/** All BLS survey estimates, seasonally adjusted. Payrolls and JOLTS levels are in thousands. */
const SERIES = {
  payrolls: 'CES0000000001', // total nonfarm employees
  rate: 'LNS14000000', // unemployment rate, percent
  openings: 'JTS000000000000000JOL',
  layoffs: 'JTS000000000000000LDL',
} as const
type Key = keyof typeof SERIES
type Points = { year: number; month: number; value: number }[]

interface PostedState { v: 1; /** `<post key>:<channel>` -> ISO time sent. */ sent: Record<string, string> }

export interface BlsRunResult {
  dryRun: boolean
  /** Nothing to check: both releases for the expected months were already posted. */
  skipped?: boolean
  posts: { key: string; text: string; results: { channel: ChannelId; status: 'sent' | 'would-send' | 'failed'; ref?: string; error?: string }[] }[]
}

const before = (m: MonthPoint, months: number): MonthPoint => {
  const i = m.year * 12 + (m.month - 1) - months
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}
const at = (points: Points, m: MonthPoint) => points.find((p) => p.year === m.year && p.month === m.month)?.value

async function fetchSeries(now: Date): Promise<Record<Key, Points>> {
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      seriesid: Object.values(SERIES), startyear: String(now.getUTCFullYear() - 1), endyear: String(now.getUTCFullYear()),
      ...(process.env.BLS_API_KEY ? { registrationkey: process.env.BLS_API_KEY } : {}),
    }),
  })
  if (!res.ok) throw new Error(`BLS returned ${res.status}`)
  const data = (await res.json()) as { status?: string; Results?: { series?: { seriesID: string; data?: { year: string; period: string; value: string }[] }[] } }
  if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${data.status}`)
  const out = {} as Record<Key, Points>
  for (const [key, id] of Object.entries(SERIES) as [Key, string][]) {
    out[key] = (data.Results?.series?.find((s) => s.seriesID === id)?.data ?? [])
      .filter((p) => /^M(0[1-9]|1[0-2])$/.test(p.period))
      .map((p) => ({ year: Number(p.year), month: Number(p.period.slice(1)), value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
  }
  return out
}

/**
 * Posts the two monthly BLS releases the day they appear: the Employment Situation (payroll change and unemployment rate, covering
 * last month) and JOLTS (job openings and layoffs, covering the month before that). Only the expected month is posted, so turning
 * posting on never announces an old release, and each release goes to each channel once. A dry run unless SOCIAL_POSTING_ENABLED=1.
 * Runs hourly; BLS is not called at all once both expected releases have gone out.
 */
export async function runBlsReleasePosts(now = new Date()): Promise<BlsRunResult> {
  const dryRun = process.env.SOCIAL_POSTING_ENABLED !== '1'
  const result: BlsRunResult = { dryRun, posts: [] }
  const channels = CHANNELS.filter((c) => c.autoFilings && c.ready())
  if (!channels.length) return result

  const thisMonth: MonthPoint = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
  const jobsMonth = before(thisMonth, 1)
  const joltsMonth = before(thisMonth, 2)
  const state = (await readJsonGz<PostedState>(STATE_BUCKET, STATE_PATH).catch(() => null)) ?? { v: 1 as const, sent: {} }
  const mk = (kind: string, m: MonthPoint) => `bls-${kind}-${m.year}-${String(m.month).padStart(2, '0')}`
  const outstanding = (key: string) => channels.some((c) => !state.sent[`${key}:${c.id}`])
  const wantJobs = outstanding(mk('jobs', jobsMonth))
  const wantJolts = outstanding(mk('jolts', joltsMonth))
  if (!wantJobs && !wantJolts) return { ...result, skipped: true }

  const s = await fetchSeries(now)
  const builders: ((utm: string, short: boolean) => SocialPost)[] = []

  const jobsPrev = before(jobsMonth, 1)
  const [payNow, payPrev, rateNow, ratePrev] = [at(s.payrolls, jobsMonth), at(s.payrolls, jobsPrev), at(s.rate, jobsMonth), at(s.rate, jobsPrev)]
  if (wantJobs && [payNow, payPrev, rateNow, ratePrev].every((v) => v !== undefined)) {
    const d: JobsReportData = { month: jobsMonth, prevMonth: jobsPrev, payrollChange: Math.round(((payNow as number) - (payPrev as number)) * 1000), rate: rateNow as number, prevRate: ratePrev as number }
    builders.push((utm, short) => jobsReportPost(d, utm, short))
  }
  const joltsPrev = before(joltsMonth, 1)
  const [open, lay, layPrev] = [at(s.openings, joltsMonth), at(s.layoffs, joltsMonth), at(s.layoffs, joltsPrev)]
  if (wantJolts && [open, lay, layPrev].every((v) => v !== undefined)) {
    const d: JoltsData = { month: joltsMonth, prevMonth: joltsPrev, openings: (open as number) * 1000, layoffs: (lay as number) * 1000, prevLayoffs: (layPrev as number) * 1000 }
    builders.push((utm, short) => joltsPost(d, utm, short))
  }

  for (const build of builders) {
    const first = build('utm_medium=social', false)
    const row: BlsRunResult['posts'][number] = { key: first.key, text: first.text, results: [] }
    for (const c of channels) {
      const id = `${first.key}:${c.id}`
      if (state.sent[id]) continue
      const post = build(`utm_source=${c.id}&utm_medium=social&utm_campaign=bls-release`, c.id === 'x')
      row.text = post.text
      if (dryRun) { row.results.push({ channel: c.id, status: 'would-send' }); continue }
      try {
        const ref = await c.post(post.text, id)
        state.sent[id] = now.toISOString()
        await writeJsonGz(STATE_BUCKET, STATE_PATH, state)
        row.results.push({ channel: c.id, status: 'sent', ref })
        captureServerEvent('cron', 'social_post_sent', { channel: c.id, kind: 'bls_release', key: first.key, ref })
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        row.results.push({ channel: c.id, status: 'failed', error })
        captureServerEvent('cron', 'social_post_failed', { channel: c.id, kind: 'bls_release', key: first.key, error })
      }
    }
    if (row.results.length) result.posts.push(row)
  }
  return result
}
