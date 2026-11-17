import { visibleIdsForInstitution } from '@/lib/plans/visible-members'
import type { ProgramPayer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { benefitsPressureLabel } from '@/lib/benefits/pressure-options'

// Everyone a workforce program helps, in one list (Program › People), and the benefits each person is matched to.
//
// Tracks come from what the program already knows: the layoff that gave someone a seat (outplacement), a training
// enrollment (retraining), and the journey the person chose in NextChapter (moving here, new graduate, career pivot,
// employed and growing). A person can be on several tracks. The journey is the member's own: a program sees it by name only
// when the member turned on SHARE_NEEDS (docs/AFFILIATIONS.md, src/lib/affiliations/visibility.ts); otherwise only the
// tracks the program itself created (the seat, the enrollment) show, and the rest reads "Not shared".
//
// Benefits are matched from three things: the layoff (unemployment insurance, dislocated-worker training), the
// training enrollment, and the help the person said they need (their money pressures and barriers from NextChapter).
// That last part shows only when the person switched on SHARE_NEEDS for this program; otherwise the record says so.
// Categories follow the barrier-removal sections regional programs publish (transportation, childcare, housing...).
//
// Data use: one query, at most PEOPLE_TAKE narrow rows (~600 B each with the joins), per page view of a staff page.

export const PEOPLE_TAKE = 300

export const TRACKS = [
  { key: 'outplacement', label: 'Outplacement', what: 'Laid off from a member company and given a seat.' },
  { key: 'retraining', label: 'Retraining', what: 'In a training program.' },
  { key: 'moving', label: 'Moving here', what: 'Looking at a move to the region.' },
  { key: 'grad', label: 'New graduates', what: 'Students and recent graduates starting out.' },
  { key: 'pivot', label: 'Career pivot', what: 'Changing fields.' },
  { key: 'growing', label: 'Employed and growing', what: 'Working, and building skills or aiming higher.' },
  { key: 'seeker', label: 'Job seekers', what: 'Looking for work, signed up on their own.' },
  { key: 'unshared', label: 'Not shared', what: 'Joined, but hasn’t shared why.' },
] as const
export type TrackKey = (typeof TRACKS)[number]['key']

export const NEED_CATEGORIES = [
  { key: 'income', label: 'Income and financial aid' },
  { key: 'education', label: 'Education and training' },
  { key: 'health', label: 'Health coverage and mental health' },
  { key: 'childcare', label: 'Childcare' },
  { key: 'housing', label: 'Housing and rent' },
  { key: 'transportation', label: 'Transportation' },
  { key: 'legal', label: 'Taxes and legal help' },
  { key: 'moving', label: 'Moving here' },
] as const
export type NeedKey = (typeof NEED_CATEGORIES)[number]['key']

export type BenefitMatch = { category: NeedKey; name: string; why: string; inUse?: boolean }

export type MatchInput = {
  laidOffFrom: string | null
  tracks: TrackKey[]
  training: { program: string; payer: ProgramPayer } | null
  // Null when the person has not shared their needs with the program.
  needs: { pressures: string[]; barriers: string[] } | null
}

// Deterministic rules, no model call. Each match says why, in the staff's words.
export function matchBenefits(p: MatchInput): BenefitMatch[] {
  const out: BenefitMatch[] = []
  const add = (m: BenefitMatch) => {
    if (!out.some((o) => o.name === m.name)) out.push(m)
  }
  if (p.laidOffFrom) {
    add({ category: 'income', name: 'Unemployment insurance', why: `Laid off from ${p.laidOffFrom}.` })
    add({ category: 'health', name: 'Health coverage after a layoff (COBRA or a marketplace plan)', why: 'Losing job coverage opens a special enrollment window.' })
  }
  if (p.training) {
    const funded = p.training.payer === 'WIOA_VOUCHER' || p.training.payer === 'BOARD_CONTRACT'
    add({ category: 'education', name: funded ? 'Dislocated worker training funds' : 'Training funds through the workforce board', why: funded ? `${p.training.program}, paid through the board.` : `In ${p.training.program}; may qualify for the board to pay.`, inUse: funded })
  } else if (p.laidOffFrom || p.tracks.includes('pivot')) {
    add({ category: 'education', name: 'Dislocated worker training funds', why: p.laidOffFrom ? 'Laid off: likely eligible for an individual training account.' : 'Changing fields: training on the eligible list could be paid.' })
  }
  if (p.tracks.includes('moving')) add({ category: 'moving', name: 'Relocation help', why: 'Looking at a move here: housing, schools and a partner job search.' })
  if (p.tracks.includes('grad')) add({ category: 'education', name: 'First-job support from partner colleges', why: 'A student or recent graduate.' })

  const n = p.needs
  if (n) {
    const said = (v: string) => `Said: ${benefitsPressureLabel(v).toLowerCase()}.`
    for (const v of n.pressures) {
      if (v === 'DEPENDENTS_CHILDCARE') {
        add({ category: 'childcare', name: 'Child care assistance', why: said(v) })
        if (p.training) add({ category: 'childcare', name: 'Supportive services during training (childcare)', why: 'In training, with childcare to cover.' })
      }
      if (v === 'RENT_MORTGAGE') add({ category: 'housing', name: 'Rental and mortgage assistance, and a free housing counselor', why: said(v) })
      if (v === 'HEALTH_INSURANCE')
        add(p.laidOffFrom ? { category: 'health', name: 'Health coverage after a layoff (COBRA or a marketplace plan)', why: said(v) } : { category: 'health', name: 'Health coverage (a marketplace plan or Medicaid)', why: said(v) })
      if (v === 'DEBT_PAYMENTS' || v === 'NO_EMERGENCY_SAVINGS' || v === 'SUPPORTING_FAMILY') add({ category: 'income', name: 'Free nonprofit credit counseling and emergency assistance', why: said(v) })
      if (v === 'IMMIGRATION_STATUS') add({ category: 'legal', name: 'Free legal help on work authorization and benefits', why: said(v) })
    }
    if (n.barriers.includes('life_logistics')) add({ category: 'transportation', name: 'Transportation help (transit and supportive services)', why: 'Said: getting to work and life logistics are in the way.' })
    if (n.barriers.includes('skills_gap')) add({ category: 'education', name: 'Dislocated worker training funds', why: 'Said: a skills gap is in the way.' })
  }
  return out
}

// `journey` is null when the member has not shared it with the program.
export function tracksFor(p: { memberCompanyId: string | null; journey: string | null; training: boolean }): TrackKey[] {
  const t: TrackKey[] = []
  if (p.memberCompanyId) t.push('outplacement')
  if (p.training) t.push('retraining')
  if (p.journey === 'EXPLORING_MOVE' && !p.memberCompanyId) t.push('moving')
  if (p.journey === 'STUDENT_NEW_GRAD' || p.journey === 'RETURNING') t.push('grad')
  if (p.journey === 'CAREER_CHANGE') t.push('pivot')
  if (p.journey === 'GROWING' || p.journey === 'PROMOTION') t.push('growing')
  if (t.length === 0) t.push(p.journey ? 'seeker' : 'unshared')
  return t
}

export type CrmPerson = Awaited<ReturnType<typeof peopleCrm>>[number]

export async function peopleCrm(institutionId: string, opts: { q?: string } = {}) {
  const visible = await visibleIdsForInstitution(institutionId)
  const rows = await prisma.institutionMember.findMany({
    where: {
      institutionId,
      ...(visible ? { id: { in: visible } } : {}),
      affiliation: 'PARTICIPANT',
      status: { not: 'OPTED_OUT' },
      ...(opts.q ? { OR: [{ email: { contains: opts.q, mode: 'insensitive' as const } }, { lastName: { contains: opts.q, mode: 'insensitive' as const } }, { firstName: { contains: opts.q, mode: 'insensitive' as const } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: PEOPLE_TAKE,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      claimedAt: true,
      createdAt: true,
      lastKnownTitle: true,
      lastKnownEmployer: true,
      memberCompanyId: true,
      memberCompany: { select: { name: true } },
      candidate: { select: { journey: true, journeyStage: true, currentCity: true, currentState: true, benefitsPressures: true, biggestBarriers: true } },
      consents: { where: { scope: { in: ['SHARE_SEARCH_DETAIL_WITH_CAREER', 'SHARE_NEEDS'] } }, orderBy: { changedAt: 'desc' }, select: { scope: true, granted: true } },
      enrollments: { where: { status: { in: ['APPLIED', 'ENROLLED', 'COMPLETED'] } }, orderBy: { appliedAt: 'desc' }, take: 1, select: { status: true, payer: true, cohort: { select: { program: { select: { name: true } } } } } },
    },
  })
  return rows.map((r) => {
    const latest = (scope: string) => r.consents.find((c) => c.scope === scope)?.granted ?? false
    const shareStage = latest('SHARE_SEARCH_DETAIL_WITH_CAREER')
    const shareNeeds = latest('SHARE_NEEDS') && !!r.candidate
    const e = r.enrollments[0]
    const training = e ? { program: e.cohort.program.name, payer: e.payer, status: e.status } : null
    const tracks = tracksFor({ memberCompanyId: r.memberCompanyId, journey: shareNeeds ? (r.candidate?.journey ?? null) : null, training: !!training })
    const needs = shareNeeds ? { pressures: r.candidate!.benefitsPressures, barriers: r.candidate!.biggestBarriers } : null
    return {
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email,
      email: r.email,
      title: r.lastKnownTitle,
      from: r.memberCompany?.name ?? r.lastKnownEmployer ?? null,
      place: r.candidate?.currentCity ? [r.candidate.currentCity, r.candidate.currentState].filter(Boolean).join(', ') : null,
      joined: !!r.claimedAt,
      createdAt: r.createdAt,
      stage: shareStage ? (r.candidate?.journeyStage ?? null) : null,
      tracks,
      training,
      sharedNeeds: !!needs,
      matches: matchBenefits({ laidOffFrom: r.memberCompany?.name ?? null, tracks, training, needs }),
    }
  })
}
