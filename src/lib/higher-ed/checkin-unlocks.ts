// Check-in, second and third steps (owner, 2026-11-21): after the one-click answer, ask only what that answer needs
// (employer, title, the role they want, how far the move is), then show "Here's what <college> has for you now": the
// college's own services and programs that fit, and which offices were told and what is paused.
//
// A job change is routed by how far it goes, which the alum says in one click:
//   same     – the same kind of role somewhere new: Career Services repositioning (résumé, story, alumni who hire for it)
//   adjacent – a new field that builds on what they do: a certificate, Exec Ed or an audited course for the gap
//   new      – a whole new field (teaching, nursing): the college's degree programs
//
// Cost: one member, one institution, at most 100 active programs (narrow columns), on a click; nothing on page load.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { serviceSettingsFrom, serviceTarget, allServices } from './services'
import { officeNamesOf, getWorkspace } from './workspaces'
import { readProfile } from './profile'
import { programsVisibleTo } from './program-sharing'
import type { CollegeCheckInAnswer } from './checkins'
import type { ChangeDistance, CheckInDetails } from './checkin-details'
export { cleanDetails } from './checkin-details'

export type UnlockCard = { key: string; title: string; detail: string; href: string; office: string }
export type Unlocks = { headline: string; cards: UnlockCard[]; sees: { office: string; what: string }[]; primary: { label: string; href: string } }

// The services worth showing first for each answer, in order. Only those the college has on (and can open) show.
const SERVICE_ORDER: Record<CollegeCheckInAnswer | `looking:${ChangeDistance}`, string[]> = {
  'looking:same': ['career_services', 'reviews', 'alumni_job_board', 'alumni_network', 'coaching'],
  'looking:adjacent': ['career_pivots', 'exec_ed', 'course_auditing', 'career_services', 'alumni_network'],
  'looking:new': ['career_pivots', 'career_services', 'alumni_network'],
  looking: ['career_services', 'career_pivots', 'alumni_job_board', 'alumni_network', 'coaching'],
  laid_off: ['career_services', 'coaching', 'financial_wellness', 'alumni_job_board', 'alumni_network', 'hardship_fund', 'wellbeing'],
  new_job: ['alumni_network', 'events', 'donations'],
  new_manager: ['exec_ed', 'learning_communities', 'alumni_network'],
  back_to_school: ['exec_ed', 'course_auditing', 'free_retraining'],
  starting_company: ['business_directory', 'alumni_network', 'events'],
  good: ['alumni_network', 'events', 'donations'],
}

// Which answers show the college's programs, and which credentials fit how far the move goes.
const wantsPrograms = (a: CollegeCheckInAnswer, d?: ChangeDistance) => a === 'back_to_school' || a === 'new_manager' || (a === 'looking' && d !== 'same')
const isDegree = (p: { credential: string | null; credentialType: string | null; name: string }) =>
  p.credentialType === 'degree' || /\b(master|bachelor|degree|m\.?s\.?|m\.?a\.?|mba|mat)\b/i.test(`${p.name} ${p.credential ?? ''}`)

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['and', 'the', 'for', 'into', 'with', 'jobs', 'job', 'role', 'roles', 'work'].includes(w))

/** Programs that fit what the alum said, best first. Exported for tests. */
export function rankPrograms<P extends { name: string; summary: string | null; skills: string[]; credential: string | null; credentialType: string | null }>(
  programs: P[],
  answer: CollegeCheckInAnswer,
  details: CheckInDetails,
): P[] {
  const want = new Set(words(details.target ?? ''))
  if (answer === 'new_manager') ['leadership', 'management', 'manager', 'managers', 'people', 'team', 'teams'].forEach((w) => want.add(w))
  const scored = programs.map((p) => {
    const text = new Set(words(`${p.name} ${p.summary ?? ''} ${p.skills.join(' ')} ${p.credential ?? ''}`))
    let score = [...want].filter((w) => text.has(w)).length * 2
    // A whole new field leans to degrees; a field next door to certificates and short programs.
    if (answer === 'looking' && details.distance === 'new' && isDegree(p)) score += 1
    if (answer === 'looking' && details.distance === 'adjacent' && !isDegree(p)) score += 1
    return { p, score }
  })
  const matched = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  // Nothing said, or nothing matched: the college's catalog still shows, most relevant kind first.
  return (matched.length ? matched : scored.sort((a, b) => b.score - a.score)).map((x) => x.p)
}

export async function checkInUnlocks(args: {
  memberId: string
  answer: CollegeCheckInAnswer
  details: CheckInDetails
  joinHref: string
  joined: boolean
  // A demo walkthrough records nothing: show what answering would do (an advisor's follow-up, paused asks).
  assume?: boolean
}): Promise<Unlocks> {
  const m = await prisma.institutionMember.findUniqueOrThrow({
    where: { id: args.memberId },
    select: {
      firstName: true,
      school: true,
      institution: { select: { id: true, slug: true, name: true, enabledFeatures: true, profile: true } },
      transitionFlags: { where: { clearedAt: null, doNotSolicit: true }, select: { id: true }, take: 1 },
      caseloadAssignments: { where: { endedAt: null }, select: { id: true }, take: 1 },
    },
  })
  const inst = m.institution
  const names = officeNamesOf(inst.enabledFeatures)
  const office = (key: string, fallback?: string) => names[key] ?? fallback ?? getWorkspace(key)?.label ?? key
  const ventures = readProfile(inst.profile).college?.entrepreneurshipCenter
  const settings = serviceSettingsFrom(inst.enabledFeatures, 'college')
  const services = new Map(allServices(inst.enabledFeatures, 'college').map((s) => [s.key, s]))
  const base = `/i/${inst.slug}`
  const owners: Record<string, string> = { career: office('career'), alumni: office('alumni'), development: office('development'), execed: office('execed'), teaching: office('execed') }

  const cards: UnlockCard[] = []
  if (wantsPrograms(args.answer, args.details.distance)) {
    const programs = await prisma.program.findMany({
      where: { institutionId: inst.id, isActive: true, ...programsVisibleTo(m.school) },
      select: { id: true, name: true, summary: true, skills: true, credential: true, credentialType: true, priceCents: true },
      take: 100,
    })
    for (const p of rankPrograms(programs, args.answer, args.details).slice(0, 2)) {
      const price = p.priceCents ? `$${Math.round(p.priceCents / 100).toLocaleString()}` : 'Free'
      cards.push({ key: `program:${p.id}`, title: p.name, detail: [p.credential && !p.name.toLowerCase().includes(p.credential.toLowerCase()) ? p.credential : null, price].filter(Boolean).join(' · '), href: `${base}/candidate/programs`, office: office('execed') })
    }
  }
  if (args.answer === 'starting_company' && ventures) {
    cards.push({ key: 'ventures', title: ventures.name, detail: 'Founder office hours, programs and alumni who could be your first customers.', href: ventures.url, office: ventures.name })
  }
  const order = SERVICE_ORDER[args.answer === 'looking' && args.details.distance ? (`looking:${args.details.distance}` as const) : args.answer]
  for (const key of order) {
    if (cards.length >= 5) break
    const s = services.get(key)
    const st = settings[key]
    const href = s && st?.on && s.memberCard ? serviceTarget(s, st) : null
    if (!s || !href) continue
    cards.push({ key, title: s.name, detail: s.pitch, href, office: (s.workspace && owners[s.workspace]) || st.ownerOffice || s.defaultOwner })
  }

  // What the college now knows and does, in its own office names. Each line is true of this member right now.
  const sees: { office: string; what: string }[] = []
  const paused = m.transitionFlags.length > 0 || (!!args.assume && args.answer === 'laid_off')
  if (args.answer === 'looking' || args.answer === 'laid_off') {
    if (m.caseloadAssignments.length || args.assume) sees.push({ office: office('career'), what: 'An advisor will follow up with you.' })
    if (args.details.distance === 'adjacent' || args.details.distance === 'new' || args.details.target) sees.push({ office: office('execed'), what: 'Sees the field you want, so its programs can reach you.' })
  }
  if (paused) sees.push({ office: office('development'), what: 'No donation asks while you search.' })
  if (args.answer === 'new_job') sees.push({ office: `${office('alumni')} and ${office('development')}`, what: 'Your news, to congratulate you.' })
  if (args.answer === 'new_manager' || args.answer === 'back_to_school') sees.push({ office: office('execed'), what: 'Programs that fit your field and your new role.' })
  if (args.answer === 'starting_company') sees.push({ office: ventures?.name ?? office('ventures'), what: 'Your company, so founder support can reach you.' })
  if (args.answer === 'good' && (args.details.employer || args.details.title)) sees.push({ office: office('alumni'), what: 'Where you work now, so news and invitations fit.' })

  const headline =
    args.answer === 'laid_off' || args.answer === 'looking'
      ? `${inst.name} has your back. Here’s what’s yours now.`
      : args.answer === 'good'
        ? `Good to hear. Here’s what ${inst.name} has for you.`
        : `Here’s what ${inst.name} has for you now.`
  const primary =
    args.answer === 'laid_off' || args.answer === 'looking' || !cards.length
      ? { label: args.joined ? 'Open your plan' : 'Get your plan and résumé grade', href: args.joined ? `${base}/candidate` : args.joinHref }
      : { label: `Open ${cards[0].title}`, href: cards[0].href }
  return { headline, cards, sees, primary }
}

/** Keep the member's employer and title current from what they told the college. */
export async function saveDetailsToMember(memberId: string, details: CheckInDetails) {
  const employer = details.employer
  if (!employer && !details.title) return
  await prisma.institutionMember.update({
    where: { id: memberId },
    data: {
      ...(employer ? { lastKnownEmployer: employer, lastKnownEmployerNormalized: normalizeOrgName(employer) } : {}),
      ...(details.title ? { lastKnownTitle: details.title } : {}),
    },
  })
}
