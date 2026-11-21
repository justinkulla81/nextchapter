// The sample alumni behind the demo bar's "Sample alum" choice. Each is a seeded sample member (isSampleData) of a demo
// institution, shaped once for its story and remembered in enabledFeatures.demoAlumni, so the choice works on a demo
// seeded before this existed without a reset. Never touches anything but a demo's own sample rows.
//
// Cost: when a story is first assigned, about 10 bounded reads and writes on one demo; afterwards one small read of the
// institution's enabledFeatures when someone looks as a non-default alum.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { DEMO_TENANTS } from './demo-tenants'
import { isDemoAlumKey, type DemoAlumKey } from './demo-alumni-shared'

type Db = Prisma.TransactionClient | typeof prisma
type Map = Partial<Record<DemoAlumKey, string>>

const DAY = 86_400_000

/** The member id to show for a sample-alum choice, or null to fall back to the featured alum. */
export async function demoAlumMember(db: Db, institution: { id: string; slug: string }, key: string | null | undefined): Promise<string | null> {
  if (!isDemoAlumKey(key) || key === 'featured') return null
  const row = await db.institution.findUnique({ where: { id: institution.id }, select: { enabledFeatures: true, isDemo: true } })
  if (!row?.isDemo) return null
  return ((row.enabledFeatures as { demoAlumni?: Map } | null)?.demoAlumni ?? {})[key] ?? null
}

/** Pick and shape the sample alumni for each story, once. Returns the map stored on the institution. */
export async function ensureDemoAlumni(institutionId: string, now = new Date(), db: Db = prisma): Promise<Map> {
  const inst = await db.institution.findUnique({ where: { id: institutionId }, select: { slug: true, isDemo: true, isSampleData: true, enabledFeatures: true } })
  if (!inst?.isDemo || !inst.isSampleData) return {}
  const features = (inst.enabledFeatures ?? {}) as Record<string, unknown>
  const existing = (features.demoAlumni ?? {}) as Map
  if (existing.laid_off && existing.changing && existing.manager && existing.newgrad) return existing
  const tenant = DEMO_TENANTS[inst.slug]
  const realEmployer = tenant?.alumniEmployers?.[0] ?? tenant?.employers[0] ?? null
  const featuredId = `${inst.slug}_member_featured`

  const joined = await db.institutionMember.findMany({
    where: { institutionId, isSampleData: true, affiliation: 'ALUM', candidateId: { not: null }, id: { not: featuredId } },
    select: { id: true, candidateId: true, classYear: true, transitionFlags: { where: { clearedAt: null }, select: { id: true }, take: 1 } },
    orderBy: { id: 'asc' },
    take: 400,
  })
  const used = new Set<string>()
  const take = (ok: (m: (typeof joined)[number]) => boolean) => {
    const m = joined.find((x) => !used.has(x.id) && ok(x))
    if (m) used.add(m.id)
    return m
  }
  const year = now.getUTCFullYear()
  const laid = take((m) => m.transitionFlags.length > 0)
  const grad = take((m) => (m.classYear ?? 0) >= year - 2)
  const changer = take((m) => (m.classYear ?? 9999) <= year - 6 && (m.classYear ?? 0) >= year - 20)
  const manager = take((m) => (m.classYear ?? 9999) <= year - 8)
  const map: Map = { laid_off: laid?.id, newgrad: grad?.id, changing: changer?.id, manager: manager?.id }

  const shape = async (m: (typeof joined)[number] | undefined, member: Prisma.InstitutionMemberUpdateInput, candidate: Prisma.CandidateProfileUpdateInput) => {
    if (!m) return
    await db.institutionMember.update({ where: { id: m.id }, data: member })
    await db.candidateProfile.update({ where: { id: m.candidateId! }, data: candidate })
  }
  await shape(
    laid,
    realEmployer ? { lastKnownEmployer: realEmployer, lastKnownEmployerNormalized: normalizeOrgName(realEmployer), lastKnownTitle: 'Operations Manager' } : {},
    { journey: 'LAID_OFF', journeyStage: 'APPLYING', primaryFunction: 'Operations' },
  )
  await shape(
    changer,
    { lastKnownTitle: 'Operations Manager' },
    {
      journey: 'CAREER_CHANGE',
      primaryFunction: 'Operations',
      targetFunction: 'Data & Analytics',
      isPivoting: true,
      resumeKeywords: ['operations', 'process improvement', 'vendor management', 'budgeting', 'scheduling', 'team leadership'],
      confirmedSkillsHave: ['operations', 'process improvement', 'budgeting'],
    },
  )
  await shape(manager, { lastKnownTitle: 'Finance Manager' }, { journey: 'GROWING', primaryFunction: 'Finance' })
  await shape(grad, { classYear: year - 1 }, { journey: 'STUDENT_NEW_GRAD' })
  // The new manager told the college so in a check-in: their cards lean to leadership programs.
  if (manager) {
    const at = new Date(now.getTime() - 12 * DAY)
    await db.checkIn.upsert({
      where: { memberId_kind_dueAt: { memberId: manager.id, kind: 'CUSTOM', dueAt: new Date(Date.UTC(year, 0, 1)) } },
      create: { memberId: manager.id, kind: 'CUSTOM', dueAt: new Date(Date.UTC(year, 0, 1)), status: 'RESPONDED', sentAt: at, respondedAt: at, responseJson: { answer: 'new_manager', details: { title: 'Finance Manager', teamSize: '4-10' } }, isSampleData: true },
      update: {},
    })
  }
  await db.institution.update({ where: { id: institutionId }, data: { enabledFeatures: { ...features, demoAlumni: map } as Prisma.InputJsonValue } })
  return map
}
