import 'server-only'
import type { CourseCategory, CourseSkillLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { SITE_URL } from '@/lib/seo/facts'
import { classifyCourse } from '@/lib/learning/course-scan/classify'
import { decodeEntities, extractLinks, pageFacts } from '@/lib/learning/course-scan/extract'

const STATE_PATH = 'courses/scan-state.json.gz'
const UA = 'NextChapterBot/1.0 (+https://launchyournextchapter.com)'
/** New pages read per run; the rest stay unseen and are picked up next week. One request at a time per host. */
const MAX_PAGE_READS = 12
const PAUSE_MS = 1000

export interface Candidate {
  url: string
  title: string
  description: string
  sponsor: string
  provider: string
  free: boolean
  skillLevel: CourseSkillLevel
  category: CourseCategory
  functions: string[]
  keywords: string[]
  /** Where it was found, for the admin's context line. */
  source: string
  foundAt: string
  /** Set when the admin added it to the catalog; it then shows with its post drafts for 30 days. */
  addedAt?: string
  xPostedAt?: string
}

interface ScanState {
  v: 1
  /** Every course URL already looked at, so it is proposed once. */
  seen: string[]
  pending: Candidate[]
  dismissed: string[]
  lastRunAt: string | null
}

const EMPTY: ScanState = { v: 1, seen: [], pending: [], dismissed: [], lastRunAt: null }

export async function loadScanState(): Promise<ScanState> {
  return (await readJsonGz<ScanState>(STATE_BUCKET, STATE_PATH).catch(() => null)) ?? { ...EMPTY }
}
export async function saveScanState(s: ScanState): Promise<void> {
  await writeJsonGz(STATE_BUCKET, STATE_PATH, s)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function get(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25_000) }).catch(() => null)
  return res?.ok ? res.text() : null
}

/** A course the page lists, before its own page is read. `title` may be a guess. */
interface Listed {
  url: string
  title: string
  description: string
  sponsor: string
  provider: string
  free: boolean
  providerLevel?: string | null
  source: string
  /** Read the course's own page for title and description. */
  needsPage: boolean
}

const hostOk = (url: string, host: RegExp) => {
  try {
    return host.test(new URL(url).hostname)
  } catch {
    return false
  }
}
const slugTitle = (url: string) => decodeURIComponent(url.split('/').pop() ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const AI_WORDS = /\b(ai|a\.i\.|generative|gen ?ai|copilot|agents?|agentic|prompt\w*|machine learning|llm|gemini|claude|chatgpt)\b/i

// Each source returns the course links it can see right now. Hosts are fixed per source, so a link
// in a fetched page can never send the scan to some other site.
const SOURCES: { id: string; list: () => Promise<Listed[]> }[] = [
  {
    // Announcement posts list the new Google Skills courses by role; each new post is read for its course links.
    id: 'Google Cloud training blog',
    async list() {
      const topic = await get('https://cloud.google.com/blog/topics/training-certifications')
      if (!topic) return []
      const posts = extractLinks(topic, 'https://cloud.google.com').filter((l) => /^https:\/\/cloud\.google\.com\/blog\/topics\/training-certifications\/[a-z0-9-]+$/.test(l.url))
      const out: Listed[] = []
      for (const post of posts.slice(0, 8)) {
        await sleep(PAUSE_MS)
        const html = await get(post.url)
        if (!html) continue
        for (const l of extractLinks(html, post.url)) {
          if (!/^https:\/\/www\.skills\.google\/course_templates\/\d+$/.test(l.url)) continue
          out.push({ url: l.url, title: l.text || '', description: '', sponsor: 'Google Cloud', provider: 'googleSkills', free: true, source: `Google Cloud blog: ${post.url}`, needsPage: true })
        }
      }
      return out
    },
  },
  {
    id: 'Anthropic Academy',
    async list() {
      const html = await get('https://anthropic.skilljar.com/')
      if (!html) return []
      return extractLinks(html, 'https://anthropic.skilljar.com/')
        .filter((l) => hostOk(l.url, /^anthropic\.skilljar\.com$/) && /^https:\/\/anthropic\.skilljar\.com\/[a-z0-9-]+$/.test(l.url) && !/faq|^$/.test(l.url))
        .map((l) => ({ url: l.url, title: l.text.length > 3 && l.text.length < 120 ? l.text : slugTitle(l.url), description: '', sponsor: 'Anthropic', provider: 'Anthropic Academy', free: true, source: 'Anthropic Academy', needsPage: true }))
    },
  },
  {
    id: 'DeepLearning.AI',
    async list() {
      const html = await get('https://www.deeplearning.ai/courses/')
      if (!html) return []
      return extractLinks(html, 'https://www.deeplearning.ai/courses/')
        .filter((l) => /^https:\/\/www\.deeplearning\.ai\/courses\/[a-z0-9-]+$/.test(l.url))
        .map((l) => ({ url: l.url, title: l.text.length > 3 && l.text.length < 120 ? l.text : slugTitle(l.url), description: '', sponsor: 'DeepLearning.AI', provider: 'DeepLearning.AI', free: false, source: 'DeepLearning.AI', needsPage: true }))
    },
  },
  {
    // Microsoft publishes its whole catalog as JSON, with levels, so no page reads are needed.
    id: 'Microsoft Learn',
    async list() {
      const json = await get('https://learn.microsoft.com/api/catalog/?type=learningPaths&locale=en-us')
      if (!json) return []
      let paths: { title?: string; summary?: string; url?: string; levels?: string[] }[] = []
      try {
        paths = (JSON.parse(json) as { learningPaths?: typeof paths }).learningPaths ?? []
      } catch {
        return []
      }
      return paths
        .filter((p) => p.url && p.title && AI_WORDS.test(`${p.title} ${p.summary ?? ''}`))
        .map((p) => ({
          url: p.url!.split('?')[0].replace(/\/+$/, ''),
          title: p.title!,
          description: decodeEntities(p.summary ?? ''),
          sponsor: 'Microsoft',
          provider: 'microsoftLearn',
          free: true,
          providerLevel: p.levels?.[0] ?? null,
          source: 'Microsoft Learn catalog',
          needsPage: false,
        }))
    },
  },
]

export interface ScanResult {
  baseline: boolean
  listed: number
  proposed: number
  pending: number
  emailed: boolean
  failedSources: string[]
}

/**
 * Weekly: looks at the sources above, proposes each AI course it has not seen (not already in the catalog, not dismissed)
 * to the admin queue at /support/admin/courses, and emails a summary. Nothing reaches the catalog or a social channel
 * until a person approves it there. The first run only records what exists. No model is used.
 */
export async function runCourseScan(now = new Date()): Promise<ScanResult> {
  const state = await loadScanState()
  const baseline = state.lastRunAt === null
  const catalog = new Set((await prisma.course.findMany({ select: { url: true } })).map((c) => c.url.replace(/\/+$/, '').toLowerCase()))
  const seen = new Set(state.seen)
  const known = (u: string) => seen.has(u) || catalog.has(u.toLowerCase()) || state.dismissed.includes(u) || state.pending.some((p) => p.url === u)

  const result: ScanResult = { baseline, listed: 0, proposed: 0, pending: 0, emailed: false, failedSources: [] }
  const fresh: Candidate[] = []
  let reads = 0

  for (const source of SOURCES) {
    const listed = await source.list().catch(() => [] as Listed[])
    if (listed.length === 0) result.failedSources.push(source.id)
    result.listed += listed.length
    for (const item of listed) {
      if (known(item.url)) continue
      if (baseline) {
        seen.add(item.url)
        continue
      }
      let { title, description } = item
      if (item.needsPage) {
        if (reads >= MAX_PAGE_READS) continue
        reads++
        await sleep(PAUSE_MS)
        const html = await get(item.url)
        if (!html) continue
        const facts = pageFacts(html)
        title = facts.title || title || slugTitle(item.url)
        description = facts.description ?? description
      }
      seen.add(item.url)
      const guess = classifyCourse({ url: item.url, title, description, providerLevel: item.providerLevel })
      if (!guess.aiRelated) continue
      fresh.push({
        url: item.url, title, description: description.slice(0, 400), sponsor: item.sponsor, provider: item.provider, free: item.free,
        skillLevel: guess.skillLevel, category: guess.category, functions: guess.functions, keywords: guess.keywords,
        source: item.source, foundAt: now.toISOString(),
      })
    }
  }

  const keepAdded = now.getTime() - 30 * 86_400_000
  const kept = state.pending.filter((p) => !p.addedAt || new Date(p.addedAt).getTime() > keepAdded)
  const next: ScanState = { v: 1, seen: [...seen], pending: [...kept, ...fresh], dismissed: state.dismissed, lastRunAt: now.toISOString() }
  await saveScanState(next)
  result.proposed = fresh.length
  result.pending = next.pending.filter((p) => !p.addedAt).length
  if (fresh.length > 0) result.emailed = await emailSummary(fresh, result.pending)
  return result
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function emailSummary(fresh: Candidate[], pendingTotal: number): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const rows = fresh
    .map(
      (c) =>
        `<li style="margin-bottom:10px"><a href="${esc(c.url)}"><b>${esc(c.title)}</b></a> (${esc(c.sponsor)})<br>` +
        `${esc(c.functions.length ? c.functions.join(', ') : 'any function')} · ${c.skillLevel.toLowerCase()} · ${c.free ? 'free' : 'check cost'}</li>`,
    )
    .join('')
  const resend = createResend(process.env.RESEND_API_KEY, 'admin')
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    to: 'justin@launchyournextchapter.com',
    subject: `${fresh.length} new AI ${fresh.length === 1 ? 'course' : 'courses'} to review`,
    html:
      `<p>The weekly scan found ${fresh.length} new AI ${fresh.length === 1 ? 'course' : 'courses'}. Nothing is added to the catalog or posted until you approve it.</p><ul style="padding-left:18px">${rows}</ul>` +
      `<p><a href="${SITE_URL}/support/admin/courses">Review, add or dismiss them</a> (${pendingTotal} waiting in all). Adding one drafts the X and LinkedIn posts.</p>` +
      `<p style="color:#666;font-size:13px">Sources checked automatically: Google Cloud training blog, Anthropic Academy, DeepLearning.AI, Microsoft Learn. Coursera, OpenAI Academy, LinkedIn Learning and the certification bodies block automated reads, so look at those yourself.</p>`,
  })
  if (error) console.error('Course scan email failed', error)
  return !error
}
