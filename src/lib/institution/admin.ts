import 'server-only'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { cleanAccentColor, cleanImageUrl, cleanSlug } from '@/lib/institution/branding'
import type { Prisma } from '@prisma/client'

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
}

export async function createInstitution(input: CreateInstitutionInput): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim()
  const slug = cleanSlug(input.slug)
  if (!name) return { error: 'Enter the college’s name.' }
  if (!slug) return { error: 'The slug must be 3–40 characters: letters, numbers and dashes.' }
  if (await prisma.institution.findUnique({ where: { slug }, select: { id: true } })) {
    return { error: `The slug "${slug}" is already taken.` }
  }
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
      profile,
    },
    select: { id: true },
  })
  return { id: created.id }
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
