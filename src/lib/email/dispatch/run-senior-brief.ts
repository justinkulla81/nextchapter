import 'server-only'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendSeniorBrief } from '@/lib/email/send-senior-brief'
import { seniorMember } from '@/lib/coach/seniority'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { ADMIN_NOTIFICATION_EMAIL } from '@/lib/admin/auth'
import { createDraft, draftsThisWeek, type DraftMember } from '@/lib/senior-brief/draft'
import { BRIEF_MIN_GAP_DAYS, ceilingReached, draftAllowed, pickItem, weeklyCeiling, type BriefContact, type BriefItem } from '@/lib/senior-brief/rules'

const DAY = 86_400_000

type MemberRow = DraftMember & { email: string | null }

/** Reads what the rules need and applies them. Read-only. */
export async function itemFor(member: DraftMember, now: Date): Promise<BriefItem | null> {
  const [contacts, outreach, watch] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: member.id },
      select: { id: true, name: true, email: true, emails: true, title: true, company: true, inferredCompany: true, warmth: true, isPriority: true, relationshipTags: true, employmentStatusAtCompany: true },
    }),
    prisma.outreachLog.findMany({
      where: { candidateId: member.id, contactId: { not: null }, loggedAt: { gte: new Date(now.getTime() - 120 * DAY) } },
      select: { contactId: true, loggedAt: true },
    }),
    prisma.companyWatchlistEntry.findMany({ where: { candidateId: member.id }, select: { companyNameNormalized: true } }),
  ])
  const briefContacts: BriefContact[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    emails: c.emails,
    title: c.title,
    company: c.company,
    inferredCompany: c.inferredCompany,
    warmth: c.warmth,
    isPriority: c.isPriority,
    isRecruiter: c.relationshipTags.includes('RECRUITER'),
    leftCompany: c.employmentStatusAtCompany === 'FORMER',
  }))
  return pickItem(
    {
      confidentialSearchMode: member.confidentialSearchMode,
      contacts: briefContacts,
      outreach,
      watchlist: watch.map((w) => w.companyNameNormalized),
      normalize: normalizeOrgName,
    },
    now,
  )
}

const MEMBER_SELECT = {
  id: true, email: true, firstName: true, lastName: true, resumeLatestJobTitle: true, highestLevelReached: true,
  confidentialSearchMode: true, notificationTier: true, seniorBriefPausedUntil: true,
} as const

// Mondays, behind SENIOR_BRIEF_ENABLED (off unless it is exactly "true"). One model call per senior member per week
// at most (see createDraft), a weekly ceiling on all drafts, and a brief only when there is a real item to draft.
// Members need a connected Gmail: the draft opens in their own Gmail, ready to send (see the brief page).
export async function runSeniorBrief(now = new Date()) {
  if (process.env.SENIOR_BRIEF_ENABLED !== 'true') return { enabled: false as const }
  const ceiling = weeklyCeiling(process.env.SENIOR_BRIEF_WEEKLY_CEILING)

  const candidates = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      email: { not: null },
      seniorBriefOptedOut: false,
      OR: [{ seniorBriefPausedUntil: null }, { seniorBriefPausedUntil: { lt: now } }],
      emailConnection: { is: { disconnectedAt: null, needsReconnectAt: null } },
    },
    select: MEMBER_SELECT,
  })

  const stats = { checked: 0, senior: 0, drafted: 0, sent: 0, skipped: 0, ceilingReached: false }
  for (const c of candidates) {
    stats.checked += 1
    try {
      if (!seniorMember(c) || !c.email) continue
      if (!shouldSendWeeklyExtraForTier(c.notificationTier)) continue
      stats.senior += 1
      const last = await prisma.seniorBriefDraft.findFirst({
        where: { candidateId: c.id, isTest: false, createdAt: { gt: new Date(now.getTime() - BRIEF_MIN_GAP_DAYS * DAY) } },
        select: { createdAt: true },
      })
      if (!draftAllowed({ lastDraftAt: last?.createdAt ?? null, pausedUntil: c.seniorBriefPausedUntil, optedOut: false }, now).ok) { stats.skipped += 1; continue }
      if (ceilingReached(await draftsThisWeek(now), ceiling)) { stats.ceilingReached = true; break }

      const item = await itemFor(c, now)
      if (!item) continue
      const draft = await createDraft(c, item, now)
      if (!draft.ok) { stats.skipped += 1; if (draft.reason === 'ceiling') { stats.ceilingReached = true; break } continue }
      stats.drafted += 1
      const r = await sendSeniorBrief({
        draftId: draft.draftId, memberId: c.id, to: c.email, firstName: c.firstName, confidentialSearchMode: c.confidentialSearchMode,
        itemKind: item.kind, contactName: item.contact.name, companyName: item.companyName,
        inputTokens: draft.inputTokens, outputTokens: draft.outputTokens,
      })
      if (r.sent) stats.sent += 1
    } catch (error) {
      console.error('Senior brief failed for candidate', c.id, error)
    }
  }
  return { enabled: true as const, ...stats }
}

/**
 * Admin test: runs the real rules on a real senior member's data (read-only for the member: no Gmail write, no member
 * email) and sends only to the admin address. The draft row is marked isTest, so it never counts against the member's cap.
 */
export async function sendSeniorBriefTest(candidateId?: string, now = new Date()): Promise<{ ok: boolean; message: string }> {
  const pool: MemberRow[] = candidateId
    ? await prisma.candidateProfile.findMany({ where: { id: candidateId }, select: MEMBER_SELECT })
    : await prisma.candidateProfile.findMany({
        where: { isSampleData: false, deactivatedAt: null, emailConnection: { is: { disconnectedAt: null } } },
        select: MEMBER_SELECT,
        orderBy: { registrationCompletedAt: 'desc' },
        take: 400,
      })
  for (const m of pool) {
    if (!seniorMember(m)) continue
    const item = await itemFor(m, now)
    if (!item) continue
    const draft = await createDraft(m, item, now, { test: true })
    if (!draft.ok) return { ok: false, message: `Draft failed (${draft.reason}).` }
    const r = await sendSeniorBrief({
      draftId: draft.draftId, memberId: m.id, to: ADMIN_NOTIFICATION_EMAIL, firstName: m.firstName, confidentialSearchMode: m.confidentialSearchMode,
      itemKind: item.kind, contactName: item.contact.name, companyName: item.companyName,
      inputTokens: draft.inputTokens, outputTokens: draft.outputTokens,
      test: { subject: draft.subject, body: draft.body, toEmail: item.toEmail },
    })
    return r.sent
      ? { ok: true, message: `Sent to ${ADMIN_NOTIFICATION_EMAIL}: ${item.kind} for member ${m.id}, ${draft.inputTokens} in / ${draft.outputTokens} out, about $${draft.estCostUsd.toFixed(4)}.` }
      : { ok: false, message: 'Draft was made but the email could not be sent. Check RESEND_API_KEY.' }
  }
  return { ok: false, message: candidateId ? 'That member is not senior, or has nothing to draft this week.' : 'No senior member with a connected Gmail has an item to draft right now.' }
}
