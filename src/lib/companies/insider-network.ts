import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'

// Insider network (Phase 2 Master Script, Part C, Prompt 4) — contribution
// gate, insider display, and the ask/answer flow. Guardrails from Prompt 5
// that this module is directly responsible for enforcing:
//   - A member must tag their own employment before querying anyone else's
//     (4.1, "real gate, not cosmetic").
//   - Never a name until an ask is answered/accepted.
//   - Current employees appear only with explicit separate opt-in.
//   - Declines are silent — the asker's own view never distinguishes
//     'declined' from 'pending'.
//   - Rate limit 3 outstanding asks per member; 14-day expiry.

// ── Confidential Search Mode proxy ──────────────────────────────────────
// No dedicated "Confidential Search Mode" boolean exists — task #966
// (NextChapter_Search_Visibility_References_Leaderboards.md) is the real,
// unbuilt feature. Proxied as privacyTier === 'STEALTH' ("visible only to
// pre-approved companies"), the closest real value to the spec's concept —
// same convention already established in
// src/app/support/admin/(portal)/population/page.tsx's ConfidentialSection.
// A STEALTH candidate's MemberEmployment rows are excluded from every
// insider surface below (list, count, ask target) — provisional until a
// real Confidential Search Mode field exists, at which point this should
// gate on that instead.
function isStealthProxy(privacyTier: string): boolean {
  return privacyTier === 'STEALTH'
}

// ── 4.1 Contribution gate ───────────────────────────────────────────────

export async function hasTaggedEmployment(candidateId: string): Promise<boolean> {
  const count = await prisma.memberEmployment.count({ where: { candidateId } })
  return count > 0
}

export interface TagEmployerInput {
  candidateId: string
  companyId: string
  title: string
  startDate: Date | null
  endDate: Date | null
  isCurrent: boolean
  verifiedFromResume: boolean
  sourceWorkHistoryEntryId?: string
}

export interface TagEmployerResult {
  created: boolean // false if this candidate+company pair was already tagged (no duplicate points)
  memberEmploymentId: string
}

// Tagging is the contribution that unlocks the graph. Current-employer rows
// default visibleAsInsider to FALSE here, overriding the schema column's
// own default of true — the spec (4.2) requires a SEPARATE explicit opt-in
// with a warning before a current employee is ever listed as an insider;
// the schema's single visibleAsInsider boolean is the same column used for
// that opt-in, just written differently at creation time depending on
// isCurrent. See setCurrentEmployerInsiderOptIn below for the explicit
// opt-in action itself.
export async function tagEmployer(input: TagEmployerInput): Promise<TagEmployerResult> {
  const existing = await prisma.memberEmployment.findUnique({
    where: { candidateId_companyId: { candidateId: input.candidateId, companyId: input.companyId } },
  })
  if (existing) return { created: false, memberEmploymentId: existing.id }

  const created = await prisma.memberEmployment.create({
    data: {
      candidateId: input.candidateId,
      companyId: input.companyId,
      title: input.title,
      function: inferFunctionFromTitle(input.title),
      seniorityBand: inferLevelFromTitle(input.title),
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      visibleAsInsider: !input.isCurrent, // see function comment
      verifiedFromResume: input.verifiedFromResume,
    },
  })
  return { created: true, memberEmploymentId: created.id }
}

// The explicit, separate current-employer opt-in (4.2) — a distinct action
// from tagEmployer above, always shown with the "you may be asked about
// your own employer" warning in the UI before this is called.
export async function setCurrentEmployerInsiderOptIn(
  candidateId: string,
  companyId: string,
  optIn: boolean
): Promise<void> {
  await prisma.memberEmployment.updateMany({
    where: { candidateId, companyId, isCurrent: true },
    data: { visibleAsInsider: optIn },
  })
}

// ── 4.2 Insider display ─────────────────────────────────────────────────

export interface InsiderSummary {
  memberEmploymentId: string
  roleLevel: string | null // seniorityBand
  function: string | null
  isCurrent: boolean
  // 'within_2yrs' | '2_5yrs' | '5yrs_plus' | 'current' — never an exact date
  tenureRecency: string
}

function tenureRecencyFor(endDate: Date | null, isCurrent: boolean): string {
  if (isCurrent) return 'current'
  if (!endDate) return '5yrs_plus'
  const yearsAgo = (Date.now() - endDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (yearsAgo <= 2) return 'within_2yrs'
  if (yearsAgo <= 5) return '2_5yrs'
  return '5yrs_plus'
}

// Never returns a name — role level, function, current/former, and a
// coarse tenure bucket only, per the spec's own display example. Excludes:
// the viewer themselves, visibleAsInsider === false rows, and any STEALTH
// candidate (see isStealthProxy above) regardless of that row's own
// visibleAsInsider value — Confidential Search Mode members are never
// listed as insiders by name, and since this list is the precursor to a
// named reveal (via an accepted ask), they're excluded upstream instead.
export async function getInsidersForCompany(companyId: string, viewerCandidateId: string): Promise<InsiderSummary[]> {
  const rows = await prisma.memberEmployment.findMany({
    where: {
      companyId,
      visibleAsInsider: true,
      candidateId: { not: viewerCandidateId },
      candidate: { privacyTier: { not: 'STEALTH' } },
    },
    select: { id: true, seniorityBand: true, function: true, isCurrent: true, endDate: true },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map((r) => ({
    memberEmploymentId: r.id,
    roleLevel: r.seniorityBand,
    function: r.function,
    isCurrent: r.isCurrent,
    tenureRecency: tenureRecencyFor(r.endDate, r.isCurrent),
  }))
}

// ── 4.3 The ask ──────────────────────────────────────────────────────────

const OUTSTANDING_ASK_LIMIT = 3
const EXPIRY_DAYS = 14

// Expiry is a computed check on read, not a separate cron — documented
// choice: insider requests are low-volume and always read through one of
// the two functions below before being shown anywhere, so there's no
// surface that would show a stale 'pending' row without also running this
// first. A dedicated cron would be more work for no real behavior
// difference at this volume.
async function expireStaleRequests(candidateWhere: { askerCandidateId?: string; insiderCandidateId?: string }): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  await prisma.insiderRequest.updateMany({
    where: { ...candidateWhere, status: 'pending', askedAt: { lt: cutoff } },
    data: { status: 'expired' },
  })
}

export interface AskInsiderResult {
  ok: boolean
  error?: string
  requestId?: string
}

export async function requestInsiderAsk(
  askerCandidateId: string,
  companyId: string,
  insiderMemberEmploymentId: string,
  question: string
): Promise<AskInsiderResult> {
  if (!(await hasTaggedEmployment(askerCandidateId))) {
    return { ok: false, error: 'Add where you\'ve worked to unlock asking an insider.' }
  }
  if (!question.trim()) {
    return { ok: false, error: 'Enter a question.' }
  }

  await expireStaleRequests({ askerCandidateId })
  const outstanding = await prisma.insiderRequest.count({
    where: { askerCandidateId, status: 'pending' },
  })
  if (outstanding >= OUTSTANDING_ASK_LIMIT) {
    return { ok: false, error: `You have ${OUTSTANDING_ASK_LIMIT} outstanding asks already — wait for a response before sending another.` }
  }

  const insider = await prisma.memberEmployment.findUnique({
    where: { id: insiderMemberEmploymentId },
    select: { id: true, companyId: true, candidateId: true, visibleAsInsider: true, candidate: { select: { privacyTier: true } } },
  })
  if (
    !insider ||
    insider.companyId !== companyId ||
    !insider.visibleAsInsider ||
    isStealthProxy(insider.candidate.privacyTier) ||
    insider.candidateId === askerCandidateId
  ) {
    return { ok: false, error: 'This insider is no longer available.' }
  }

  const created = await prisma.insiderRequest.create({
    data: {
      companyId,
      askerCandidateId,
      insiderCandidateId: insider.candidateId,
      question: question.trim(),
      status: 'pending',
    },
  })
  return { ok: true, requestId: created.id }
}

export interface InsiderRequestForAsker {
  id: string
  companyId: string
  companyName: string
  question: string
  // Never 'declined' here — silently remapped to 'pending' (see
  // askerVisibleStatus below). Only 'pending' | 'answered' | 'expired' can
  // ever reach the asker's own view.
  status: 'pending' | 'answered' | 'expired'
  answer: string | null
  askedAt: Date
}

// A decline is indistinguishable from still-pending from the asker's side,
// by product design (Prompt 4.3 — "Declines are silent"). This is the ONE
// place that mapping happens; every other read of InsiderRequest.status in
// this module is the real, unmapped value.
function askerVisibleStatus(status: string): 'pending' | 'answered' | 'expired' {
  if (status === 'answered') return 'answered'
  if (status === 'expired') return 'expired'
  return 'pending' // covers 'pending', 'declined', and 'accepted'
}

export async function getInsiderRequestsForAsker(candidateId: string): Promise<InsiderRequestForAsker[]> {
  await expireStaleRequests({ askerCandidateId: candidateId })
  const rows = await prisma.insiderRequest.findMany({
    where: { askerCandidateId: candidateId },
    include: { company: { select: { name: true } } },
    orderBy: { askedAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.company.name,
    question: r.question,
    status: askerVisibleStatus(r.status),
    answer: r.status === 'answered' ? r.answer : null,
    askedAt: r.askedAt,
  }))
}

export interface InsiderRequestForInsider {
  id: string
  companyId: string
  companyName: string
  question: string
  status: string // real status, not remapped — the insider is the one who sets it
  askedAt: Date
}

// The insider's own queue — real statuses, never remapped. Excludes
// already-declined/expired rows from the default view (nothing left to do
// with them) but callers can still see them via getInsiderRequestsForAsker-
// style history if ever needed; this function is scoped to "what can I
// still act on."
export async function getPendingInsiderRequestsForInsider(candidateId: string): Promise<InsiderRequestForInsider[]> {
  await expireStaleRequests({ insiderCandidateId: candidateId })
  const rows = await prisma.insiderRequest.findMany({
    where: { insiderCandidateId: candidateId, status: 'pending' },
    include: { company: { select: { name: true } } },
    orderBy: { askedAt: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.company.name,
    question: r.question,
    status: r.status,
    askedAt: r.askedAt,
  }))
}

export interface RespondResult {
  ok: boolean
  error?: string
}

export async function answerInsiderRequest(
  requestId: string,
  insiderCandidateId: string,
  answer: string
): Promise<RespondResult> {
  if (!answer.trim()) return { ok: false, error: 'Enter an answer.' }
  const request = await prisma.insiderRequest.findUnique({ where: { id: requestId } })
  if (!request || request.insiderCandidateId !== insiderCandidateId || request.status !== 'pending') {
    return { ok: false, error: 'This request is no longer available.' }
  }
  await prisma.insiderRequest.update({
    where: { id: requestId },
    data: { status: 'answered', answer: answer.trim(), respondedAt: new Date() },
  })
  return { ok: true }
}

// Silent by design — the asker's read path (askerVisibleStatus) already
// maps 'declined' back to 'pending', so this action itself is the only
// place the real decline is ever recorded.
export async function declineInsiderRequest(requestId: string, insiderCandidateId: string): Promise<RespondResult> {
  const request = await prisma.insiderRequest.findUnique({ where: { id: requestId } })
  if (!request || request.insiderCandidateId !== insiderCandidateId || request.status !== 'pending') {
    return { ok: false, error: 'This request is no longer available.' }
  }
  await prisma.insiderRequest.update({
    where: { id: requestId },
    data: { status: 'declined', respondedAt: new Date() },
  })
  return { ok: true }
}
