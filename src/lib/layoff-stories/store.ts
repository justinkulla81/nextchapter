import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendLayoffStoryLinkEmail } from '@/lib/email/send-layoff-story-email'
import { CLAIM_TOKEN_DAYS, hashClaimToken, hashIp, newClaimToken } from '@/lib/org-claims/token'
import { SITE_URL } from '@/lib/org-claims/urls'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { COUNTED_STATUSES, MAX_STORIES_PER_EMAIL_PER_DAY, MAX_STORIES_PER_IP_PER_HOUR, checkStory, storyNumbers, type StoryNumbers } from './rules'

// Layoff stories (/layoffs/stories). The answers count toward a company's numbers once the email is confirmed. The story text is shown only
// for ANONYMOUS or NAMED stories a person approved, and only while LAYOFF_STORIES_PUBLISH is on. Name and email sit in LayoffStoryIdentity.

const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '')

/** Public stories are off until the terms are reviewed. */
export const publishOpen = () => process.env.LAYOFF_STORIES_PUBLISH === '1'

export type SubmitStoryResult = { ok: true; emailSent: string | null; emailFailed: boolean } | { ok: false; error: string }

export async function submitStory(raw: Record<string, unknown>, ip: string | null): Promise<SubmitStoryResult> {
  const checked = checkStory(raw, publishOpen())
  if (!checked.ok) return checked
  const v = checked.value

  // A listed company keeps its slug; a typed one that matches a listed name takes it; anything else is stored as typed with no slug.
  const companies = await getCompanies()
  let slug: string | null = v.companySlug && companies.has(v.companySlug) ? v.companySlug : null
  let companyName = slug ? companies.get(slug)!.name : v.companyName
  if (!slug) {
    const lower = v.companyName.toLowerCase()
    for (const c of companies.values()) if (c.name.toLowerCase() === lower) { slug = c.slug; companyName = c.name; break }
  }

  const ipHash = ip ? hashIp(ip, process.env.ORG_CLAIM_IP_SALT || 'layoff-story') : null
  const [byIp, byEmail] = await Promise.all([
    ipHash ? prisma.layoffStory.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - 3_600_000) } } }) : Promise.resolve(0),
    v.email ? prisma.layoffStoryIdentity.count({ where: { email: v.email, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) : Promise.resolve(0),
  ])
  if (byIp >= MAX_STORIES_PER_IP_PER_HOUR || byEmail >= MAX_STORIES_PER_EMAIL_PER_DAY) return { ok: false, error: 'Too many stories from this connection or email. Wait a while and try again.' }

  const verify = newClaimToken()
  const withdraw = newClaimToken()
  const hasEmail = v.email !== ''
  const story = await prisma.layoffStory.create({
    data: {
      companySlug: slug, companyName, toldMonth: v.toldMonth, fn: v.fn, title: v.title, level: v.level,
      tenure: v.tenure, foundOut: v.foundOut, noticeGiven: v.noticeGiven, warnNotice: v.warnNotice, severance: v.severance, signedRelease: v.signedRelease, whereNow: v.whereNow,
      helpWanted: v.helpWanted.join(','), body: v.body, visibility: v.visibility,
      status: hasEmail ? 'PENDING_EMAIL' : 'UNVERIFIED',
      tokenHash: hasEmail ? verify.tokenHash : null, tokenExpiresAt: hasEmail ? verify.expiresAt : null,
      withdrawTokenHash: withdraw.tokenHash, ipHash, source: String(raw.source ?? '').slice(0, 60),
    },
    select: { id: true },
  })
  if (hasEmail) await prisma.layoffStoryIdentity.create({ data: { storyId: story.id, email: v.email, name: v.name || null } })

  let emailSent: string | null = null
  if (hasEmail) {
    const sent = await sendLayoffStoryLinkEmail({
      to: v.email, companyName, days: CLAIM_TOKEN_DAYS, publishing: v.visibility !== 'PRIVATE',
      verifyUrl: `${siteUrl()}/layoffs/stories/verify/${verify.token}`, withdrawUrl: `${siteUrl()}/layoffs/stories/withdraw/${withdraw.token}`,
    })
    if (sent) emailSent = v.email
  }
  captureServerEvent(`layoff-story:${story.id}`, 'layoff_story_submitted', {
    storyId: story.id, companySlug: slug, listed: !!slug, fn: v.fn, level: v.level, visibility: v.visibility, hasEmail, emailSent: !!emailSent, hasBody: v.body !== '', answered: [v.tenure, v.foundOut, v.noticeGiven, v.warnNotice, v.severance, v.signedRelease, v.whereNow].filter(Boolean).length, helpWanted: v.helpWanted, source: String(raw.source ?? ''),
  })
  return { ok: true, emailSent, emailFailed: hasEmail && !emailSent }
}

export type VerifyStoryResult = 'verified' | 'already' | 'expired' | 'invalid'

/** The person opens the emailed link and confirms. A private story is then counted; a public one waits for a person on the team. */
export async function verifyStory(token: string): Promise<VerifyStoryResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid'
  const row = await prisma.layoffStory.findUnique({ where: { tokenHash: hashClaimToken(token) }, select: { id: true, companySlug: true, visibility: true, emailVerifiedAt: true, tokenExpiresAt: true, status: true } })
  if (!row || row.status === 'WITHDRAWN') return 'invalid'
  if (row.emailVerifiedAt) return 'already'
  if (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() <= Date.now()) return 'expired'
  await prisma.layoffStory.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date(), status: row.visibility === 'PRIVATE' ? 'COUNTED' : 'PENDING_REVIEW' } })
  captureServerEvent(`layoff-story:${row.id}`, 'layoff_story_email_confirmed', { storyId: row.id, companySlug: row.companySlug, visibility: row.visibility })
  return 'verified'
}

export type WithdrawStoryResult = 'withdrawn' | 'already' | 'invalid'

/** Withdraws a story: the text and the identity are deleted, and the answers stop counting. The link works at any time. */
export async function withdrawStory(token: string): Promise<WithdrawStoryResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid'
  const row = await prisma.layoffStory.findUnique({ where: { withdrawTokenHash: hashClaimToken(token) }, select: { id: true, companySlug: true, status: true } })
  if (!row) return 'invalid'
  if (row.status === 'WITHDRAWN') return 'already'
  await prisma.$transaction([
    prisma.layoffStory.update({ where: { id: row.id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date(), body: '', title: '', tokenHash: null, helpWanted: '' } }),
    prisma.layoffStoryIdentity.deleteMany({ where: { storyId: row.id } }),
  ])
  captureServerEvent(`layoff-story:${row.id}`, 'layoff_story_withdrawn', { storyId: row.id, companySlug: row.companySlug })
  return 'withdrawn'
}

/** Confirmed answers for a company, as numbers. Fail-soft: a missing table reads as none. */
export async function storyNumbersFor(companySlug: string): Promise<StoryNumbers> {
  try {
    const rows = await prisma.layoffStory.findMany({ where: { companySlug, status: { in: COUNTED_STATUSES } }, select: { fn: true, foundOut: true, noticeGiven: true, severance: true, whereNow: true } })
    return storyNumbers(rows)
  } catch {
    return { total: 0, questions: {} }
  }
}

export interface PublicStory { id: string; fn: string; level: string; tenure: string; toldMonth: string; body: string; name: string | null; title: string }

/** Approved public stories for a company. Empty while public stories are off. Fail-soft. */
export async function approvedStories(companySlug: string): Promise<PublicStory[]> {
  if (!publishOpen()) return []
  try {
    const rows = await prisma.layoffStory.findMany({ where: { companySlug, status: 'APPROVED', body: { not: '' } }, orderBy: { reviewedAt: 'desc' }, take: 20 })
    const named = rows.filter((r) => r.visibility === 'NAMED').map((r) => r.id)
    const ids = named.length ? await prisma.layoffStoryIdentity.findMany({ where: { storyId: { in: named } }, select: { storyId: true, name: true } }) : []
    const nameById = new Map(ids.map((i) => [i.storyId, i.name]))
    return rows
      .map((r) => ({ id: r.id, fn: r.fn, level: r.level, tenure: r.tenure, toldMonth: r.toldMonth, body: r.body, title: r.title, name: r.visibility === 'NAMED' ? (nameById.get(r.id) ?? null) : null }))
      .sort((a, b) => Number(!!b.name) - Number(!!a.name))
  } catch {
    return []
  }
}

/** How many confirmed people have shared a story, per company slug. Fail-soft. */
export async function storyCounts(): Promise<Map<string, number>> {
  try {
    const rows = await prisma.layoffStory.groupBy({ by: ['companySlug'], where: { companySlug: { not: null }, status: { in: COUNTED_STATUSES } }, _count: { _all: true } })
    return new Map(rows.map((r) => [r.companySlug as string, r._count._all]))
  } catch {
    return new Map()
  }
}

export async function pendingStories() {
  const rows = await prisma.layoffStory.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' }, take: 100 })
  const ids = await prisma.layoffStoryIdentity.findMany({ where: { storyId: { in: rows.map((r) => r.id) } } })
  const byId = new Map(ids.map((i) => [i.storyId, i]))
  return rows.map((r) => ({ ...r, email: byId.get(r.id)?.email ?? '', name: byId.get(r.id)?.name ?? null }))
}

export async function reviewStory(id: string, decision: 'APPROVED' | 'REJECTED', note: string | null): Promise<void> {
  const row = await prisma.layoffStory.update({ where: { id }, data: { status: decision, reviewedAt: new Date(), reviewNote: note?.slice(0, 500) || null }, select: { companySlug: true } })
  captureServerEvent(`layoff-story:${id}`, decision === 'APPROVED' ? 'layoff_story_approved' : 'layoff_story_rejected', { storyId: id, companySlug: row.companySlug })
}
