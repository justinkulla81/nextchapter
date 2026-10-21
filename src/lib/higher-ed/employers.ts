// Employers at a college (spec §5.4, §5.5, HE-13): an employer on
// NextChapter asks to recruit a college's alumni, Career Services approves
// and sets the package, and an approved employer gets a page, roles only
// that college's members see (FEATURED pins them), and intro requests to
// members who share their Dossier with employers. The member decides.

import 'server-only'
import type { InstitutionEmployerPackageTier, InstitutionEmployerStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { linkPostingToCompany } from '@/lib/companies/posting-company'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { InstitutionAccess } from './resolve'
import { sendCampaign } from './outreach'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Roles an employer posts carry addedBy = EMPLOYER_TAG + their profile id, so
// their page lists their own roles without a column on the shared table.
export const EMPLOYER_TAG = 'employer:'

// The employer profile this request acts as: the person's own approved
// link, or, for a NextChapter admin previewing a demo college, the demo's
// first approved employer.
export async function employerProfileFor(ctx: Pick<InstitutionAccess, 'employerProfileIds' | 'isNcAdmin' | 'institution'> & { mode?: InstitutionAccess['mode'] }): Promise<string | null> {
  if (ctx.employerProfileIds[0]) return ctx.employerProfileIds[0]
  // A NextChapter admin or a prospect's guest pass, previewing a demo.
  if (!(ctx.isNcAdmin || ctx.mode === 'demo-guest') || !ctx.institution.isDemo) return null
  const e = await prisma.institutionEmployer.findFirst({ where: { institutionId: ctx.institution.id, status: 'APPROVED' }, select: { employerProfileId: true } })
  return e?.employerProfileId ?? null
}

// Signed-in employer asks to recruit this college's alumni.
export async function applyToRecruit(institutionId: string, userId: string) {
  const profile = await prisma.employerProfile.findFirst({
    where: { OR: [{ userId }, { seats: { some: { userId, acceptedAt: { not: null } } } }] },
    select: { id: true },
  })
  if (!profile) return { error: 'no-profile' as const }
  const row = await prisma.institutionEmployer.upsert({
    where: { institutionId_employerProfileId: { institutionId, employerProfileId: profile.id } },
    create: { institutionId, employerProfileId: profile.id },
    update: {},
    select: { status: true },
  })
  return { status: row.status }
}

export async function listCollegeEmployers(institutionId: string) {
  return prisma.institutionEmployer.findMany({
    where: { institutionId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      packageTier: true,
      featuredUntil: true,
      createdAt: true,
      employerProfile: { select: { companyName: true, companyWebsite: true, companyIndustry: true, contactName: true } },
    },
  })
}

export async function setEmployerStatus(institutionId: string, id: string, status: InstitutionEmployerStatus, by: string) {
  return prisma.institutionEmployer.updateMany({
    where: { id, institutionId },
    data: status === 'APPROVED' ? { status, approvedBy: by, approvedAt: new Date() } : { status },
  })
}

export async function setEmployerPackage(institutionId: string, id: string, packageTier: InstitutionEmployerPackageTier, featuredUntil: Date | null) {
  return prisma.institutionEmployer.updateMany({
    where: { id, institutionId },
    data: { packageTier, featuredUntil: packageTier === 'FEATURED' ? featuredUntil : null },
  })
}

export async function postEmployerRole(args: {
  institutionId: string
  employerProfileId: string
  title: string
  location: string | null
  url: string
  description: string | null
}) {
  const p = await prisma.employerProfile.findUniqueOrThrow({ where: { id: args.employerProfileId }, select: { companyName: true } })
  return prisma.exclusiveJobPosting.create({
    data: {
      title: args.title,
      companyName: p.companyName,
      companyId: await linkPostingToCompany(p.companyName),
      location: args.location,
      url: args.url,
      description: args.description,
      postingType: 'direct',
      salaryCurrency: 'USD',
      audienceTier: 'ALL_CANDIDATES',
      distribution: 'OPEN',
      disclosure: 'OPEN',
      // Reviewed by a NextChapter admin like every employer posting.
      status: 'pending',
      source: 'institution_employer',
      addedBy: `${EMPLOYER_TAG}${args.employerProfileId}`,
      institutionScopeId: args.institutionId,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
    },
    select: { id: true },
  })
}

export async function employerRoles(institutionId: string, employerProfileId: string) {
  return prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: institutionId, addedBy: `${EMPLOYER_TAG}${employerProfileId}`, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, location: true, status: true, createdAt: true },
  })
}

// The member's Alumni jobs: approved roles scoped to this college, featured
// employers' roles first while their feature runs.
export async function collegeJobs(institutionId: string, now = new Date()) {
  const [jobs, featured] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { institutionScopeId: institutionId, status: 'approved', archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, companyName: true, companyId: true, location: true, url: true, addedBy: true, createdAt: true },
    }),
    prisma.institutionEmployer.findMany({
      where: { institutionId, status: 'APPROVED', packageTier: 'FEATURED', featuredUntil: { gt: now } },
      select: { employerProfileId: true },
    }),
  ])
  const featuredTags = new Set(featured.map((f) => `${EMPLOYER_TAG}${f.employerProfileId}`))
  return jobs
    .map((j) => ({ ...j, featured: featuredTags.has(j.addedBy), normalized: normalizeOrgName(j.companyName) }))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
}

export const INTRO_SUBJECT = '{{company}} would like to meet you'
export const INTRO_BODY = `Hi {{firstName}},

{{company}} saw the Dossier you share with employers through {{college}} and asked for an introduction.

"{{note}}"

Accept or decline on your {{college}} page. They get your email only if you accept: {{link}}

{{college}} Career Services`

export async function requestIntro(args: { institutionId: string; employerProfileId: string; memberId: string; requestedBy: string; note: string }) {
  const [shares] = await prisma.$queryRaw<{ ok: boolean }[]>`
    select true as ok from private.v_employer_dossiers where "institutionId" = ${args.institutionId} and "memberId" = ${args.memberId}`
  if (!shares) return { error: 'This member no longer shares their Dossier with employers.' }
  const existing = await prisma.dossierIntroRequest.findUnique({
    where: { employerProfileId_memberId: { employerProfileId: args.employerProfileId, memberId: args.memberId } },
    select: { status: true },
  })
  if (existing) return { error: existing.status === 'DECLINED' ? 'They declined an earlier request.' : 'You already asked to meet them.' }
  const [req, company, inst] = await Promise.all([
    prisma.dossierIntroRequest.create({
      data: { institutionId: args.institutionId, employerProfileId: args.employerProfileId, memberId: args.memberId, requestedBy: args.requestedBy, note: args.note.slice(0, 1000) || null },
      select: { id: true },
    }),
    prisma.employerProfile.findUniqueOrThrow({ where: { id: args.employerProfileId }, select: { companyName: true } }),
    prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true, orgType: true } }),
  ])
  await sendCampaign({
    institutionId: args.institutionId,
    type: 'CUSTOM',
    subject: INTRO_SUBJECT,
    // A workforce org's participants hear from the org, not Career Services.
    body: inst.orgType === 'COLLEGE' ? INTRO_BODY : INTRO_BODY.replace('{{college}} Career Services', '{{college}}').replace('through {{college}}', 'with hiring companies through {{college}}'),
    createdBy: args.requestedBy,
    recipients: [{ memberId: args.memberId, extra: { company: company.companyName, note: args.note.slice(0, 500) || 'We’d like to talk about a role.' } }],
    linkFor: () => `${appUrl()}/i/${inst.slug}/candidate`,
  })
  return { id: req.id }
}

// What the employer sees for each Dossier: their request's status, and the
// member's email only once accepted.
export async function introStatusFor(employerProfileId: string, memberIds: string[]) {
  const rows = await prisma.dossierIntroRequest.findMany({
    where: { employerProfileId, memberId: { in: memberIds } },
    select: { memberId: true, status: true, member: { select: { email: true } } },
  })
  return new Map(rows.map((r) => [r.memberId, { status: r.status, email: r.status === 'ACCEPTED' ? r.member.email : null }]))
}

export async function pendingIntros(memberId: string) {
  return prisma.dossierIntroRequest.findMany({
    where: { memberId, status: 'REQUESTED' },
    orderBy: { requestedAt: 'desc' },
    select: { id: true, note: true, requestedAt: true, employerProfile: { select: { companyName: true, companyWebsite: true } } },
  })
}

export async function respondToIntro(memberId: string, requestId: string, accept: boolean) {
  const r = await prisma.dossierIntroRequest.updateMany({
    where: { id: requestId, memberId, status: 'REQUESTED' },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })
  return r.count > 0
}
