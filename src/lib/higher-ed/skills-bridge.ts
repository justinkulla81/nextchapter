// The skills bridge for colleges: from the skills an alum has to the job they
// want, through the college's own offerings.
//
// 1. Target jobs: the alum's function (NextChapter profile), and the skills
//    open jobs in that function ask for most (the daily skills-market snapshot).
// 2. Their gap: those skills their résumé, confirmed skills and certifications
//    don't show (skillsIntel, the same rule as Widen your search).
// 3. The bridge: the college's programs, audit courses and service offerings
//    tagged with that skill (Program.skills, AuditCourse.skills, the service's
//    "Skills it teaches").
// 4. The job: opening an offering through the bridge is recorded; a later
//    "I got a job" (OutcomeReport) counts toward that offering.
//
// Staff see counts only (MIN_CELL_SIZE): skills alumni need, which have no
// offering yet (what to teach next), and which offerings were followed by jobs.
//
// Cost: a member view reads one profile (keywords, function) and the college's
// tagged offerings; the snapshot is held 30 minutes per instance. NEED rows are
// written once per member and skill (skipDuplicates). The staff report is three
// grouped statements returning a few hundred short rows at most.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { functionKeyFor, skillsIntel } from '@/lib/jobs/widen-strategy'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { normalizeMajor } from './major-groups-shared'
import { pivotTargetOf } from '@/lib/journey/pivot-target'
import { programsVisibleTo } from './program-sharing'
import { serviceSettingsFrom, serviceTarget, allServices, PRICING_LABELS } from './services'

export const normSkill = (s: string) => normalizeMajor(s)

export type BridgeOffering = { key: string; kind: 'program' | 'audit' | 'service'; name: string; detail: string | null; skills: string[]; href: string }

/** The college's offerings that teach at least one tagged skill. */
// `forMember`: one alum's bridge shows only programs their school can see (program-sharing.ts); the staff report sees all.
export async function bridgeOfferings(institution: { id: string; slug: string }, enabledFeatures: unknown, forMember?: { school: string | null }): Promise<BridgeOffering[]> {
  const [programs, audits] = await Promise.all([
    prisma.program.findMany({ where: { institutionId: institution.id, isActive: true, NOT: { skills: { isEmpty: true } }, ...(forMember ? programsVisibleTo(forMember.school) : {}) }, select: { id: true, name: true, priceCents: true, credential: true, skills: true }, take: 100 }),
    prisma.auditCourse.findMany({ where: { institutionId: institution.id, isActive: true, NOT: { skills: { isEmpty: true } } }, select: { id: true, title: true, term: true, skills: true }, take: 100 }),
  ])
  const settings = serviceSettingsFrom(enabledFeatures)
  const services = allServices(enabledFeatures).filter((s) => {
    const st = settings[s.key]
    return st?.on && s.memberCard && st.skills.length > 0 && serviceTarget(s, st)
  })
  const base = `/i/${institution.slug}/candidate/programs`
  return [
    ...programs.map((p) => ({
      key: `program:${p.id}`,
      kind: 'program' as const,
      name: p.name,
      detail: [p.priceCents ? `$${(p.priceCents / 100).toLocaleString()}` : 'Free', p.credential].filter(Boolean).join(' · '),
      skills: p.skills.map(normSkill),
      href: `${base}#open-programs`,
    })),
    ...audits.map((a) => ({ key: `audit:${a.id}`, kind: 'audit' as const, name: a.title, detail: `Audit, no tuition · ${a.term}`, skills: a.skills.map(normSkill), href: `${base}#audit-h` })),
    ...services.map((s) => ({
      key: `service:${s.key}`,
      kind: 'service' as const,
      name: s.name,
      detail: [PRICING_LABELS[settings[s.key].pricing], settings[s.key].provider === 'partner' ? `From ${settings[s.key].partnerName}` : null].filter(Boolean).join(' · '),
      skills: settings[s.key].skills,
      href: `/i/${institution.slug}/go/${s.key}`,
    })),
  ]
}

/** Does an offering teach this skill? Whole-phrase match on the normalized name or slug. */
export function teaches(o: BridgeOffering, skill: { name: string; slug: string }): boolean {
  const a = normSkill(skill.name)
  const b = normSkill(skill.slug.replace(/-/g, ' '))
  return o.skills.includes(a) || o.skills.includes(b)
}

export type BridgeRow = { skill: string; slug: string; share: number; offerings: BridgeOffering[] }
export type MemberBridge =
  | { state: 'ready'; fnLabel: string; basis: number; have: string[]; rows: BridgeRow[]; moving?: boolean }
  | { state: 'no-function' | 'no-skills' | 'no-data' }

/** One alum's bridge. Pure given its inputs; exported for tests. */
export function buildBridge(
  intel: { label: string; basis: number; have: { name: string }[]; missing: { slug: string; name: string; share: number }[] } | null,
  offerings: BridgeOffering[],
): MemberBridge {
  if (!intel) return { state: 'no-data' }
  return {
    state: 'ready',
    fnLabel: intel.label,
    basis: intel.basis,
    have: intel.have.map((h) => h.name),
    rows: intel.missing.map((m) => ({ skill: m.name, slug: m.slug, share: m.share, offerings: offerings.filter((o) => teaches(o, m)) })),
  }
}

export async function memberBridge(args: { institution: { id: string; slug: string }; memberId: string; enabledFeatures: unknown }): Promise<MemberBridge> {
  const member = await prisma.institutionMember.findUnique({
    where: { id: args.memberId },
    select: { school: true, candidate: { select: { primaryFunction: true, targetFunction: true, resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true } } },
  })
  const p = member?.candidate
  // Someone moving to another function is measured against the jobs they want, not the ones they're leaving
  // (owner, 2026-11-21; pivotTargetOf is the one source of truth for a move).
  const target = p ? pivotTargetOf(p) : null
  const fn = target ?? p?.primaryFunction
  if (!p || !fn) return { state: 'no-function' }
  const terms = skillTerms(p)
  if (!terms.length) return { state: 'no-skills' }
  const [market, offerings] = await Promise.all([loadSkillsMarket(), bridgeOfferings(args.institution, args.enabledFeatures, { school: member?.school ?? null })])
  const built = buildBridge(skillsIntel(market, terms, { dim: 'function', key: functionKeyFor(fn) }, fn, 6), offerings)
  const bridge: MemberBridge = built.state === 'ready' && target ? { ...built, moving: true } : built
  if (bridge.state === 'ready' && bridge.rows.length) {
    // What alumni need, for staff counts. Once per member and skill.
    await prisma.skillBridgeEvent
      .createMany({ data: bridge.rows.map((r) => ({ institutionId: args.institution.id, memberId: args.memberId, kind: 'NEED', skill: normSkill(r.skill) })), skipDuplicates: true })
      .catch((err) => console.error('[skills-bridge] need', err))
  }
  return bridge
}

export async function recordOpened(args: { institutionId: string; memberId: string; skill: string; offeringKey: string }) {
  await prisma.skillBridgeEvent.createMany({
    data: [{ institutionId: args.institutionId, memberId: args.memberId, kind: 'OPENED', skill: normSkill(args.skill), offeringKey: args.offeringKey }],
    skipDuplicates: true,
  })
}

const atLeast = (n: number) => (n >= MIN_CELL_SIZE ? n : null)

export type BridgeReport = {
  needs: { skill: string; alumni: number | null; planning: number | null; hasOffering: boolean }[]
  offerings: { key: string; name: string; kind: BridgeOffering['kind']; opened: number | null; landed: number | null }[]
  totalNeeding: number
}

/** Staff view: counts only. */
export async function bridgeReport(institution: { id: string; slug: string }, enabledFeatures: unknown): Promise<BridgeReport> {
  const [needs, opened, landed, offerings, totals, plans] = await Promise.all([
    prisma.$queryRaw<{ skill: string; n: number }[]>`
      select skill, count(distinct "memberId")::int as n from public."SkillBridgeEvent"
      where "institutionId" = ${institution.id} and kind = 'NEED'
      group by skill order by n desc limit 40`,
    prisma.$queryRaw<{ key: string; n: number }[]>`
      select "offeringKey" as key, count(distinct "memberId")::int as n from public."SkillBridgeEvent"
      where "institutionId" = ${institution.id} and kind = 'OPENED'
      group by "offeringKey"`,
    // A job reported after first opening the offering through the bridge.
    prisma.$queryRaw<{ key: string; n: number }[]>`
      select e."offeringKey" as key, count(distinct e."memberId")::int as n
      from (select "offeringKey", "memberId", min("createdAt") as at from public."SkillBridgeEvent"
            where "institutionId" = ${institution.id} and kind = 'OPENED' group by 1, 2) e
      where exists (select 1 from public."OutcomeReport" o where o."memberId" = e."memberId" and o."reportedAt" > e.at)
      group by 1`,
    bridgeOfferings(institution, enabledFeatures),
    prisma.$queryRaw<{ n: number }[]>`select count(distinct "memberId")::int as n from public."SkillBridgeEvent" where "institutionId" = ${institution.id} and kind = 'NEED'`,
    // Planning to learn: members whose own learning plan has a planned or started course naming the skill, the same measure as
    // the workforce Skills gaps screen (skills-supply.ts). One grouped read over this institution's members' plan rows.
    prisma.$queryRaw<{ skill: string; n: number }[]>`
      select s as skill, count(distinct e."candidateId")::int as n
      from public."LearningPlanEntry" e
      join public."InstitutionMember" m on m."candidateId" = e."candidateId" and m."institutionId" = ${institution.id}
      cross join lateral unnest(e.skills) as s
      where e.status in ('PLANNED', 'STARTED')
      group by s limit 500`.catch(() => [] as { skill: string; n: number }[]),
  ])
  const planningBy = new Map<string, number>()
  for (const r of plans) {
    const k = normSkill(r.skill)
    planningBy.set(k, (planningBy.get(k) ?? 0) + r.n)
  }
  const openedBy = new Map(opened.map((r) => [r.key, r.n]))
  const landedBy = new Map(landed.map((r) => [r.key, r.n]))
  const taught = new Set(offerings.flatMap((o) => o.skills))
  return {
    needs: needs.map((r) => ({ skill: r.skill, alumni: atLeast(r.n), planning: atLeast(planningBy.get(normSkill(r.skill)) ?? 0), hasOffering: taught.has(r.skill) })),
    offerings: offerings.map((o) => ({ key: o.key, name: o.name, kind: o.kind, opened: atLeast(openedBy.get(o.key) ?? 0), landed: atLeast(landedBy.get(o.key) ?? 0) })),
    totalNeeding: totals[0]?.n ?? 0,
  }
}
