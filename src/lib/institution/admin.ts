import 'server-only'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { cleanAccentColor, cleanImageUrl, cleanSlug } from '@/lib/institution/branding'
import type { Prisma } from '@prisma/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'

// NextChapter-side creation and tailoring of a college workspace. A college that has not
// signed is created as a DEMO: it works exactly like the real portal but is flagged so
// nothing about it is mistaken for a customer, and it can be filled with sample content.

export interface CreateInstitutionInput {
  name: string
  slug: string
  domains: string[]
  programBrandName?: string | null
  accentColor?: string | null
  logoUrl?: string | null
  heroImageUrl?: string | null
  tagline?: string | null
  isDemo: boolean
  /** LocalCollege (the CRM's college list) picked in the admin form; when absent, matched by name or created. */
  localCollegeId?: string | null
}

export async function createInstitution(input: CreateInstitutionInput): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim()
  const slug = cleanSlug(input.slug)
  if (!name) return { error: 'Enter the college’s name.' }
  if (!slug) return { error: 'The slug must be 3–40 characters: letters, numbers and dashes.' }
  if (await prisma.institution.findUnique({ where: { slug }, select: { id: true } })) {
    return { error: `The slug "${slug}" is already taken.` }
  }
  const crm = await resolveCrmCollege(name, input.localCollegeId ?? null, input.domains[0] ?? null)
  if ('error' in crm) return crm
  const profile: Prisma.InputJsonObject = {
    ...(cleanImageUrl(input.heroImageUrl) ? { heroImageUrl: cleanImageUrl(input.heroImageUrl) as string } : {}),
    ...(input.tagline?.trim() ? { tagline: input.tagline.trim().slice(0, 160) } : {}),
  }
  const created = await prisma.institution.create({
    data: {
      name,
      slug,
      programBrandName: input.programBrandName?.trim() || null,
      accentColor: cleanAccentColor(input.accentColor),
      logoUrl: cleanImageUrl(input.logoUrl),
      domains: input.domains.map((d) => d.trim().toLowerCase()).filter(Boolean),
      isDemo: input.isDemo,
      crmOrganizationId: crm.id,
      profile,
    },
    select: { id: true },
  })
  return { id: created.id }
}

// Every college workspace points at one CRM college. A college picked from the CRM's
// college list (LocalCollege, IPEDS) uses its CRM organization, making one if it has none
// yet; with no pick, an exact normalized-name match is reused (never a fuzzy guess) and
// only otherwise is a UNIVERSITY record created, so the college is in the CRM either way.
async function resolveCrmCollege(
  name: string,
  localCollegeId: string | null,
  domain: string | null
): Promise<{ id: string } | { error: string }> {
  const college = localCollegeId
    ? await prisma.localCollege.findUnique({ where: { id: localCollegeId }, select: { id: true, name: true, website: true, city: true, state: true, crmOrgId: true } })
    : null
  if (localCollegeId && !college) return { error: 'That CRM college no longer exists. Pick it again.' }

  let orgId = college?.crmOrgId ?? null
  if (!orgId) {
    const orgName = college?.name ?? name
    const canonicalNameNormalized = normalizeOrgName(orgName)
    const existing = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized }, select: { id: true, orgTypes: true } })
    if (existing) {
      orgId = existing.id
      if (!existing.orgTypes.includes('UNIVERSITY')) {
        await prisma.crmOrganization.update({ where: { id: existing.id }, data: { orgTypes: { push: 'UNIVERSITY' } } })
      }
    } else {
      const made = await prisma.crmOrganization.create({
        data: {
          name: orgName,
          canonicalNameNormalized,
          orgTypes: ['UNIVERSITY'],
          website: college?.website ?? (domain ? `https://${domain}` : null),
          hqCity: college?.city ?? null,
          usState: college?.state ?? null,
        },
        select: { id: true },
      })
      orgId = made.id
    }
    if (college) await prisma.localCollege.update({ where: { id: college.id }, data: { crmOrgId: orgId } })
  }
  const taken = await prisma.institution.findUnique({ where: { crmOrganizationId: orgId }, select: { name: true } })
  if (taken) return { error: `${taken.name} already has a college workspace for this CRM record.` }
  return { id: orgId }
}

export async function updateInstitutionBranding(
  id: string,
  input: Partial<Pick<CreateInstitutionInput, 'programBrandName' | 'accentColor' | 'logoUrl' | 'heroImageUrl' | 'tagline'>>
): Promise<void> {
  const current = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { profile: true } })
  const profile = { ...((current.profile as Record<string, unknown> | null) ?? {}) }
  if (input.heroImageUrl !== undefined) {
    const url = cleanImageUrl(input.heroImageUrl)
    if (url) profile.heroImageUrl = url
    else delete profile.heroImageUrl
  }
  if (input.tagline !== undefined) {
    if (input.tagline?.trim()) profile.tagline = input.tagline.trim().slice(0, 160)
    else delete profile.tagline
  }
  await prisma.institution.update({
    where: { id },
    data: {
      ...(input.programBrandName !== undefined && { programBrandName: input.programBrandName?.trim() || null }),
      ...(input.accentColor !== undefined && { accentColor: cleanAccentColor(input.accentColor) }),
      ...(input.logoUrl !== undefined && { logoUrl: cleanImageUrl(input.logoUrl) }),
      profile: profile as Prisma.InputJsonObject,
    },
  })
}

// Sample content so a demo looks lived in. Everything is scoped to this one college and
// clearly marked "(Sample)", so it can never be mistaken for a real posting, and only a
// claimed member of this college could ever see it (there are none in a demo).
const SAMPLE_TARGETS = ['Accenture', 'Deloitte', 'UPMC', 'PNC Financial Services', 'Highmark', 'Siemens']
const SAMPLE_JOBS = [
  { title: 'Director of Operations (Sample)', companyName: 'Sample Health System', location: 'Pittsburgh, PA' },
  { title: 'Senior Financial Analyst (Sample)', companyName: 'Sample Regional Bank', location: 'Washington, PA' },
  { title: 'Program Manager, Community Partnerships (Sample)', companyName: 'Sample Foundation', location: 'Pittsburgh, PA' },
]

export async function seedDemoContent(institutionId: string, addedBy: string): Promise<{ targets: number; jobs: number }> {
  let targets = 0
  for (const name of SAMPLE_TARGETS) {
    const company = await getOrCreateCompany(name)
    await prisma.institutionTargetCompany.upsert({
      where: { institutionId_companyId: { institutionId, companyId: company.id } },
      create: { institutionId, companyId: company.id, note: 'Sample target', createdBy: addedBy },
      update: {},
    })
    targets++
  }
  let jobs = 0
  for (const j of SAMPLE_JOBS) {
    const url = `https://example.com/sample/${institutionId}/${encodeURIComponent(j.title)}`
    if (await prisma.exclusiveJobPosting.findFirst({ where: { url }, select: { id: true } })) continue
    await prisma.exclusiveJobPosting.create({
      data: {
        ...j,
        url,
        description: 'Sample posting for the demo. Not a real role.',
        postingType: 'direct',
        audienceTier: 'ALL_CANDIDATES',
        distribution: 'OPEN',
        disclosure: 'OPEN',
        status: 'approved',
        source: 'institution',
        addedBy,
        institutionScopeId: institutionId,
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
      },
    })
    jobs++
  }
  return { targets, jobs }
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

// Stored in the existing public logo bucket under institutions/<id>/, so a demo's logo
// and hero image are plain public URLs the portal can render.
export async function uploadInstitutionImage(institutionId: string, file: File | null, kind: 'logo' | 'hero'): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null
  const check = await validateUpload(file, 'image', MAX_IMAGE_BYTES)
  if (!check.ok) return { error: check.error }
  const admin = createAdminClient()
  const path = `institutions/${institutionId}/${kind}-${crypto.randomUUID()}.${check.ext}`
  const { error } = await admin.storage.from('coach-logos').upload(path, file, { contentType: check.contentType })
  if (error) return { error: 'The image could not be uploaded. Try again.' }
  return admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
}

