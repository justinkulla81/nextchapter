import 'server-only'
import { prisma } from '@/lib/prisma'
import { escapeHtml } from './render'
import { appUrl } from './editions'

/**
 * A first draft for a new edition, from what the database already knows —
 * no model calls, so drafting costs nothing however often a list goes out.
 *
 * Starts from the list's last email (the voice and structure you already
 * approved), moves its period name forward, and swaps in a fresh "Since my
 * last note" block: layoff filings and our published takes since that email
 * went out. Roadmap items are left out on purpose — their titles are
 * internal notes, not sentences for investors or customers. Anything that still needs you is a
 * [[Write: …]] marker, and an edition can't be sent while one is left.
 */

export const PLACEHOLDER_RE = /\[\[[^\]]*\]\]/

const SINCE_HEADING = 'Since my last note'
// The block this module wrote last time: its heading paragraph and the list
// (or placeholder paragraph) right after it.
const SINCE_BLOCK_RE = new RegExp(`<p><b>${SINCE_HEADING}</b></p>\\s*(<ul>[\\s\\S]*?</ul>|<p>[\\s\\S]*?</p>)`, 'i')

export interface PrefillInput {
  listId: string
  listName: string
  /** 'October 2026', 'Q4 2026', 'Tuesday, October 7' — or null for ad hoc. */
  periodLabel: string | null
}

export interface Prefill {
  subject: string
  previewText: string | null
  bodyHtml: string
  /** The period label of the email it was copied from, if any. */
  copiedFromId: string | null
}

const fmt = (n: number) => n.toLocaleString('en-US')

async function sinceItems(since: Date): Promise<string[]> {
  const [warn, takes] = await Promise.all([
    prisma.warnNotice.aggregate({
      where: { noticeDate: { gte: since } }, _count: { _all: true }, _sum: { employees: true },
    }),
    prisma.researchLibraryItem.findMany({
      where: { newsTake: { not: null }, newsSlug: { not: null }, newsPublishedAt: { gte: since } },
      orderBy: { newsPublishedAt: 'desc' }, take: 4, select: { newsTitle: true, newsSlug: true },
    }),
  ]).catch((e) => {
    console.error('Mailing prefill could not read its sources', e)
    return [{ _count: { _all: 0 }, _sum: { employees: 0 } }, []] as const
  })

  const items: string[] = []
  if (warn._count._all > 0) {
    const people = warn._sum.employees ?? 0
    items.push(`<li>${fmt(warn._count._all)} new layoff ${warn._count._all === 1 ? 'filing' : 'filings'}${people > 0 ? ` covering ${fmt(people)} workers` : ''} in the WARN data we track.</li>`)
  }
  for (const t of takes) {
    items.push(`<li><a href="${appUrl()}/news/${encodeURIComponent(t.newsSlug!)}">${escapeHtml(t.newsTitle ?? 'Our latest take')}</a></li>`)
  }
  return items
}

function sinceBlock(items: string[]): string {
  return items.length
    ? `<p><b>${SINCE_HEADING}</b></p><ul>${items.join('')}</ul>`
    : `<p><b>${SINCE_HEADING}</b></p><p>[[Write: what changed since the last email]]</p>`
}

export async function prefillEdition({ listId, listName, periodLabel }: PrefillInput): Promise<Prefill> {
  const last = await prisma.mailingEdition.findFirst({
    where: { lists: { some: { listId } } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, subject: true, previewText: true, bodyHtml: true, sentAt: true, createdAt: true },
  })
  const since = last?.sentAt ?? last?.createdAt ?? new Date(Date.now() - 31 * 86_400_000)
  const block = sinceBlock(await sinceItems(since))

  if (!last || !last.bodyHtml.trim()) {
    const intro = periodLabel ? `Here is the ${escapeHtml(periodLabel)} note from NextChapter.` : 'A quick note from NextChapter.'
    return {
      subject: periodLabel ? `${listName}: ${periodLabel}` : listName,
      previewText: null,
      bodyHtml: `<p>Hi {{firstName}},</p><p>${intro}</p>${block}<p>[[Write: the one thing you want them to take away]]</p><p>Justin</p>`,
      copiedFromId: null,
    }
  }

  // Move the old period name forward wherever it appears ("September 2026"
  // in the subject and body becomes "October 2026").
  const oldLabel = periodLabel ? labelIn(last.title) : null
  const roll = (s: string) => (oldLabel && periodLabel ? s.split(oldLabel).join(periodLabel) : s)

  const body = SINCE_BLOCK_RE.test(last.bodyHtml)
    ? last.bodyHtml.replace(SINCE_BLOCK_RE, block)
    : insertAfterGreeting(last.bodyHtml, block)

  return {
    subject: last.subject.trim() ? roll(last.subject) : periodLabel ? `${listName}: ${periodLabel}` : listName,
    previewText: last.previewText ? roll(last.previewText) : null,
    bodyHtml: roll(body),
    copiedFromId: last.id,
  }
}

/** The period part of an edition title: 'October 2026', 'Q4 2026', 'Tuesday, October 7', '2026'. */
function labelIn(title: string): string | null {
  const m =
    title.match(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), [A-Z][a-z]+ \d{1,2}/) ??
    title.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d{2}/) ??
    title.match(/Q[1-4] 20\d{2}/) ??
    title.match(/\b20\d{2}\b/)
  return m?.[0] ?? null
}

function insertAfterGreeting(html: string, block: string): string {
  const end = html.indexOf('</p>')
  return end === -1 ? block + html : html.slice(0, end + 4) + block + html.slice(end + 4)
}
