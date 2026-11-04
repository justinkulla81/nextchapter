import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { CHANNELS, type ChannelId } from '@/lib/social/channels'
import { announcementBasis, announcementPostText, filingPostText } from '@/lib/social/posts'
import { captureServerEvent } from '@/lib/posthog/server'

const STATE_PATH = 'social/filings-posted.json.gz'
const DAY_MS = 86_400_000
/** Same bar as the manual X queue (src/lib/warn/publishing-queue.ts), but only filings from the last few days: this stream is for news, not backfill. */
export const FILING_MIN_WORKERS = 100
export const FILING_MAX_AGE_DAYS = 3
/** Per run and per channel per day, so a busy day or a first run never floods a channel. */
export const MAX_PER_RUN = 3
export const MAX_PER_CHANNEL_PER_DAY = 8
/** X bills each post, so it gets only the biggest filings and a small daily cap (3 a day is about $18 a month at $0.20 a post). */
export const FILING_RULES: Partial<Record<ChannelId, { minWorkers: number; perDay: number }>> = { x: { minWorkers: 250, perDay: 3 } }

interface PostedState {
  v: 1
  /** `<notice id>:<channel>` -> ISO time sent. */
  sent: Record<string, string>
}

export interface FilingRunResult {
  dryRun: boolean
  channels: ChannelId[]
  posts: { noticeId: string; kind: 'filing' | 'announcement'; employer: string; text: string; results: { channel: ChannelId; status: 'sent' | 'would-send' | 'failed'; ref?: string; error?: string }[] }[]
}

/**
 * Posts each qualifying WARN filing to every free channel that is configured, biggest first, after any emailed layoff announcement
 * that an SEC filing or two outlets back (a single-outlet story stays in the admin queue). A dry run unless SOCIAL_POSTING_ENABLED=1. X gets
 * only filings of 250+ workers, three a day at most (FILING_RULES), because it is billed per post. Each notice goes to each channel once (state
 * is saved after every send), and one channel failing never blocks the others.
 */
export async function runFilingPosts(now = new Date()): Promise<FilingRunResult> {
  const dryRun = process.env.SOCIAL_POSTING_ENABLED !== '1'
  const channels = CHANNELS.filter((c) => c.autoFilings && c.ready())
  const result: FilingRunResult = { dryRun, channels: channels.map((c) => c.id), posts: [] }
  if (!channels.length) return result

  const state = (await readJsonGz<PostedState>(STATE_BUCKET, STATE_PATH).catch(() => null)) ?? { v: 1 as const, sent: {} }
  const sinceDay = now.getTime() - DAY_MS
  const sentToday = (ch: ChannelId) => Object.entries(state.sent).filter(([k, at]) => k.endsWith(`:${ch}`) && new Date(at).getTime() > sinceDay).length

  const select = { id: true, employer: true, employees: true, state: true, noticeDate: true, companyMatchStatus: true, layoffType: true, company: { select: { name: true } } } as const
  const [filings, announced] = await Promise.all([
    prisma.warnNotice.findMany({
      where: {
        source: { not: 'MANUAL_ANNOUNCEMENT' }, dismissedAt: null, employees: { gte: FILING_MIN_WORKERS },
        noticeDate: { gte: new Date(now.getTime() - FILING_MAX_AGE_DAYS * DAY_MS), lte: now },
      },
      orderBy: { employees: 'desc' }, take: 40, select,
    }),
    // Layoffs the owner emailed in: published to the layoff RSS feed (rssPublishedAt), so they are cleared for the channels too.
    // Newest first, because they are news; the age is counted from publication, since the story's date can be a day or two earlier.
    prisma.warnNotice.findMany({
      where: {
        source: 'MANUAL_ANNOUNCEMENT', dismissedAt: null,
        rssPublishedAt: { gte: new Date(now.getTime() - FILING_MAX_AGE_DAYS * DAY_MS), lte: now },
        OR: [{ employees: null }, { employees: { gte: FILING_MIN_WORKERS } }],
      },
      orderBy: { rssPublishedAt: 'desc' }, take: 20, select,
    }),
  ])
  const items = [...announced.map((x) => ({ ...x, kind: 'announcement' as const })), ...filings.map((x) => ({ ...x, kind: 'filing' as const }))]

  let posted = 0
  for (const n of items) {
    if (posted >= MAX_PER_RUN) break
    const slug = employerSlug(n.employer, n.companyMatchStatus === 'MATCHED' ? n.company?.name ?? null : null)
    if (!slug || !n.noticeDate) continue
    // One outlet is not enough to post a layoff; an SEC filing or two outlets is.
    const sourcing = announcementBasis(n.layoffType)
    if (n.kind === 'announcement' && sourcing.basis === 'unconfirmed') continue
    const due = channels.filter((c) => {
      const rule = FILING_RULES[c.id]
      return !state.sent[`${n.id}:${c.id}`] && (n.employees ?? 0) >= (rule?.minWorkers ?? 0) && sentToday(c.id) < (rule?.perDay ?? MAX_PER_CHANNEL_PER_DAY)
    })
    if (!due.length) continue
    const path = `/layoffs/company/${slug}`
    const row: FilingRunResult['posts'][number] = { noticeId: n.id, kind: n.kind, employer: n.employer, text: '', results: [] }
    for (const c of due) {
      const utm = `utm_source=${c.id}&utm_medium=social&utm_campaign=${n.kind === 'announcement' ? 'layoff-announcement' : 'warn-filing'}`
      const shortLinks = c.id === 'x'
      const text = n.kind === 'announcement' && sourcing.basis !== 'unconfirmed'
        ? announcementPostText({ employer: n.employer, state: n.state, workers: n.employees, percent: sourcing.percent, basis: sourcing.basis, path }, utm, shortLinks)
        : filingPostText({ employer: n.employer, state: n.state, workers: n.employees, date: n.noticeDate, path }, utm, shortLinks)
      row.text = text
      if (dryRun) { row.results.push({ channel: c.id, status: 'would-send' }); continue }
      try {
        const ref = await c.post(text, `${n.id}:${c.id}`)
        state.sent[`${n.id}:${c.id}`] = now.toISOString()
        await writeJsonGz(STATE_BUCKET, STATE_PATH, state)
        row.results.push({ channel: c.id, status: 'sent', ref })
        captureServerEvent('cron', 'social_post_sent', { channel: c.id, kind: n.kind, noticeId: n.id, employer: n.employer, workers: n.employees, ref })
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        row.results.push({ channel: c.id, status: 'failed', error })
        captureServerEvent('cron', 'social_post_failed', { channel: c.id, kind: n.kind, noticeId: n.id, error })
      }
    }
    result.posts.push(row)
    posted++
  }
  return result
}
