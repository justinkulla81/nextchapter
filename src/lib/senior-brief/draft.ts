import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { captureServerEvent } from '@/lib/posthog/server'
import { DRAFT_MODEL, estimateCostUsd } from './cost'
import { BRIEF_MIN_GAP_DAYS, ceilingReached, draftSubject, weekKey, weeklyCeiling, type BriefItem } from './rules'

const DAY = 86_400_000

export type DraftMember = {
  id: string
  firstName: string | null
  lastName: string | null
  resumeLatestJobTitle: string | null
  confidentialSearchMode: boolean
}

export type DraftResult =
  | { ok: true; draftId: string; subject: string; body: string; inputTokens: number; outputTokens: number; estCostUsd: number }
  | { ok: false; reason: 'too_soon' | 'ceiling' | 'already_drafted' | 'model_failed' }

export function startOfWeek(now: Date): Date {
  return new Date(`${weekKey(now)}T00:00:00.000Z`)
}

/** Real (non-test) drafts started this week, across all members. The weekly ceiling counts these. */
export async function draftsThisWeek(now: Date): Promise<number> {
  return prisma.seniorBriefDraft.count({ where: { isTest: false, createdAt: { gte: startOfWeek(now) } } })
}

function buildPrompt(member: DraftMember, item: BriefItem, notes: string | null, tags: string[]): string {
  const c = item.contact
  const me = [member.firstName, member.lastName].filter(Boolean).join(' ')
  const known = [
    `Recipient: ${c.name}`,
    c.title && `Their title: ${c.title}`,
    item.companyName && `Their company: ${item.companyName}`,
    tags.length > 0 && `How the sender knows them: ${tags.join(', ').toLowerCase().replace(/_/g, ' ')}`,
    item.daysSinceContact !== null && `Last contact: about ${item.daysSinceContact} days ago`,
    notes && `Sender's own notes about them: ${notes.slice(0, 600)}`,
  ].filter(Boolean)
  const goal =
    item.kind === 'recruiter_follow_up'
      ? 'A short follow-up to a recruiter the sender has already spoken with: keep the conversation alive, say the sender is still interested in hearing about roles that fit, and ask if anything has come up.'
      : item.companyName
        ? `A short note to a contact at ${item.companyName} asking whether they would be open to a 15-minute conversation, or to introducing the sender to the right person there.`
        : 'A short note asking whether the recipient would be open to a 15-minute conversation.'
  return `You are drafting a private one-to-one email for a senior professional to send from their own account.

Sender: ${me || 'the sender'}${member.resumeLatestJobTitle ? `, ${member.resumeLatestJobTitle}` : ''}
${known.join('\n')}

Goal: ${goal}
${member.confidentialSearchMode ? '\nThe sender is working confidentially. Never say or imply they are looking for work, open to offers, or leaving. Frame it only as catching up and wanting to learn about the company or field.\n' : ''}
Rules:
- Under 110 words. Plain, direct, warm, no hype, no flattery, no clichés ("pick your brain", "touch base", "circle back", "hope this finds you well").
- Use only the facts above. Never invent shared history, results, mutual contacts, roles, compliments or reasons for reaching out.
- Greet the recipient by first name and sign off with the sender's first name${member.firstName ? ` (${member.firstName})` : ''}.
- Output only the email body. No subject line, no brackets, no placeholders.`
}

/**
 * The one model call for a member's week. Claims the week first (the unique row), so a second run, a retry
 * or a duplicate cron fire cannot spend a second call. Real drafts are also held to the 6-day gap and the weekly
 * ceiling here, not only in the cron. Test drafts (isTest) skip both and use a unique week key.
 */
export async function createDraft(member: DraftMember, item: BriefItem, now: Date, opts: { test?: boolean } = {}): Promise<DraftResult> {
  const test = !!opts.test
  if (!test) {
    const recent = await prisma.seniorBriefDraft.findFirst({
      where: { candidateId: member.id, isTest: false, createdAt: { gt: new Date(now.getTime() - BRIEF_MIN_GAP_DAYS * DAY) } },
      select: { id: true },
    })
    if (recent) return { ok: false, reason: 'too_soon' }
    if (ceilingReached(await draftsThisWeek(now), weeklyCeiling(process.env.SENIOR_BRIEF_WEEKLY_CEILING))) return { ok: false, reason: 'ceiling' }
  }

  const subject = draftSubject(item.kind, item.companyName)
  let row: { id: string }
  try {
    row = await prisma.seniorBriefDraft.create({
      data: {
        candidateId: member.id,
        weekKey: test ? `test:${now.getTime()}` : weekKey(now),
        isTest: test,
        itemKind: item.kind,
        contactId: item.contact.id,
        contactName: item.contact.name,
        companyName: item.companyName,
        toEmail: item.toEmail,
        subject,
      },
      select: { id: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, reason: 'already_drafted' }
    throw error
  }

  try {
    const contact = await prisma.supportNetworkContact.findUnique({ where: { id: item.contact.id }, select: { notes: true, relationshipTags: true } })
    const res = await getAnthropicClient().messages.create({
      model: DRAFT_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(member, item, contact?.notes ?? null, contact?.relationshipTags ?? []) }],
    })
    const body = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
    if (!body) throw new Error('empty draft')
    const inputTokens = res.usage.input_tokens
    const outputTokens = res.usage.output_tokens
    const estCostUsd = estimateCostUsd(inputTokens, outputTokens)
    await prisma.seniorBriefDraft.update({
      where: { id: row.id },
      data: { body, model: DRAFT_MODEL, inputTokens, outputTokens, estCostUsd, status: 'DRAFTED' },
    })
    if (!test) {
      captureServerEvent(member.id, 'senior_brief_drafted', { memberId: member.id, itemKind: item.kind, draftId: row.id, inputTokens, outputTokens, estCostUsd })
    }
    return { ok: true, draftId: row.id, subject, body, inputTokens, outputTokens, estCostUsd }
  } catch (error) {
    console.error('Senior brief draft failed for', member.id, error)
    // The row stays (status FAILED) so the week is spent: no retry loop that could call the model again.
    await prisma.seniorBriefDraft.update({ where: { id: row.id }, data: { status: 'FAILED' } }).catch(() => {})
    return { ok: false, reason: 'model_failed' }
  }
}
