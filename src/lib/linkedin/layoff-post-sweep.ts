import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  ANGLES, LAYOUTS, MAX_AGE_DAYS, MIN_EMPLOYEES, WEEKLY_CAP,
  assignSlots, credibilityOf, draftText, eligibleAngles, leastRecent,
  type Angle, type DraftFacts,
} from './layoff-post-rules'

const SENIOR = ['EXECUTIVE', 'VP', 'DIRECTOR', 'SENIOR_MANAGER', 'MANAGER']

export interface DraftSweepResult {
  considered: number
  credible: number
  created: { employer: string; scheduledFor: Date }[]
  /** Credible notices left for a later run because the week's cap is used. */
  deferred: number
}

/**
 * Turns credible, recent layoffs into suggested LinkedIn posts, and stages each
 * at a weekday slot so a busy news day spreads out instead of landing at once.
 * Runs at the end of the layoff-news cron (every three hours) and is
 * idempotent: a notice that already has a draft is skipped, and a notice that
 * is not yet credible is looked at again next run, when a second publisher may
 * have reported it. No model call is made here; the wording is the template
 * text, which the morning rewrite replaces for the posts worth sending.
 */
export async function runLinkedInDraftSweep(now = new Date()): Promise<DraftSweepResult> {
  const result: DraftSweepResult = { considered: 0, credible: 0, created: [], deferred: 0 }
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  const candidates = await prisma.warnNotice.findMany({
    where: {
      linkedinDraft: null, dismissedAt: null,
      employees: { gte: MIN_EMPLOYEES },
      fetchedAt: { gte: new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000) },
    },
    orderBy: { employees: 'desc' },
    take: 60,
  })
  result.considered = candidates.length
  if (candidates.length === 0) return result

  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: candidates.map((n) => n.id) } },
    select: { noticeId: true, publisher: true },
  })
  const credible = candidates.flatMap((n) => {
    const why = credibilityOf(n, mentions.filter((m) => m.noticeId === n.id).map((m) => m.publisher), now)
    return why ? [{ n, why }] : []
  })
  result.credible = credible.length

  const [madeThisWeek, waiting, recent] = await Promise.all([
    prisma.linkedInPostDraft.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.linkedInPostDraft.findMany({ where: { status: 'DRAFT', scheduledFor: { gte: now } }, select: { scheduledFor: true } }),
    prisma.linkedInPostDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { angle: true, layout: true } }),
  ])
  const room = Math.max(0, WEEKLY_CAP - madeThisWeek)
  const chosen = credible.slice(0, room) // already biggest first
  result.deferred = credible.length - chosen.length
  if (chosen.length === 0) return result

  const slots = assignSlots(chosen.length, waiting.map((w) => w.scheduledFor), now)
  const recentAngles: string[] = recent.map((r) => r.angle)
  const recentLayouts: number[] = recent.map((r) => r.layout)

  for (const [i, { n, why }] of chosen.entries()) {
    const scheduledFor = slots[i]
    if (!scheduledFor) { result.deferred++; continue }

    const state = n.state
    const [openRolesInState, openSeniorRolesInState, tagSuggestions] = await Promise.all([
      state ? prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state } } }) : Promise.resolve(null),
      state ? prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state }, seniorityGroup: { in: SENIOR } } }) : Promise.resolve(null),
      tagSuggestionsFor(n.promotedOrgId, n.normalizedEmployer, n.workforceBoardId),
    ])
    const facts: DraftFacts = {
      employer: n.employer, employees: n.employees ?? 0,
      percent: percentFrom(n.layoffType),
      place: n.county && state ? `${n.county.replace(/ county$/i, '')} County, ${state}` : state,
      state, noticeDate: n.noticeDate?.toISOString() ?? null, effectiveDate: n.effectiveDate?.toISOString() ?? null,
      industry: n.industry, sourceUrl: n.sourceUrl, credibility: why,
      openRolesInState, openSeniorRolesInState, tagSuggestions,
    }
    const angle = leastRecent<Angle>(eligibleAngles(facts), recentAngles as Angle[], n.id)
    const layout = leastRecent(LAYOUTS.map((_, k) => k), recentLayouts, n.id)
    const text = draftText(angle, facts, n.id)
    try {
      await prisma.linkedInPostDraft.create({
        data: {
          noticeId: n.id, angle, layout, body: text.body, firstComment: text.firstComment,
          scheduledFor, facts: facts as unknown as Prisma.InputJsonValue, credibility: why,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue // another run made it first
      throw e
    }
    recentAngles.unshift(angle)
    recentLayouts.unshift(layout)
    result.created.push({ employer: n.employer, scheduledFor })
    captureServerEvent('cron', 'linkedin_draft_created', {
      noticeId: n.id, employer: n.employer, employees: n.employees, angle, layout, credibility: why, scheduledFor: scheduledFor.toISOString(),
    })
  }
  return result
}

/** "12% of staff" in a news layoff's label, the one place the share is kept. */
function percentFrom(label: string | null): number | null {
  const m = label?.match(/(\d{1,3}(?:\.\d+)?)% of staff/)
  return m ? parseFloat(m[1]) : null
}

/**
 * Who is worth @-mentioning on the post: up to three people we already know at
 * the employer (most recently touched first), and the local workforce board
 * that runs Rapid Response there. The employer's own page is always worth a
 * tag and is added in the admin. These are prompts: tags are typed by hand.
 */
async function tagSuggestionsFor(orgId: string | null, normalizedEmployer: string, boardId: string | null) {
  const out: DraftFacts['tagSuggestions'] = []
  try {
    const org = orgId
      ? { id: orgId }
      : await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: normalizedEmployer }, select: { id: true } })
    if (org) {
      const people = await prisma.crmPerson.findMany({
        where: { deletedAt: null, linkedinUrl: { not: null }, affiliations: { some: { orgId: org.id, isCurrent: true } } },
        orderBy: { lastTouchedAt: { sort: 'desc', nulls: 'last' } },
        take: 3,
        select: { fullName: true, linkedinUrl: true },
      })
      for (const p of people) out.push({ name: p.fullName, note: 'in our CRM at this employer', linkedinUrl: p.linkedinUrl })
    }
    if (boardId) {
      const board = await prisma.workforceBoard.findUnique({ where: { id: boardId }, select: { name: true, website: true } })
      if (board) out.push({ name: board.name, note: 'local workforce board (runs Rapid Response)', linkedinUrl: null })
    }
  } catch (e) {
    console.error('LinkedIn draft tag suggestions failed for', normalizedEmployer, e)
  }
  return out
}
