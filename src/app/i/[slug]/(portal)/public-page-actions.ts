'use server'

import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { orgKindOf } from '@/lib/higher-ed/workspaces'
import { readProfile } from '@/lib/higher-ed/profile'
import { formValues, parsePublicPageForm } from '@/lib/public-page/content'
import { savePublicPage } from '@/lib/public-page/store'
import type { PublicPageFormState } from '@/components/public-page/PublicPageEditor'

// Admin › Public page: a college or workforce organization on the paid plan writes its own section on its public page.
export async function savePublicPageAction(slug: string, _prev: PublicPageFormState, formData: FormData): Promise<PublicPageFormState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const values = formValues(formData)
  if (!institutionEntitlements({ plan: ctx.institution.plan }).publicPage) return { error: lockedReason('publicPage'), values }
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true, logoUrl: true, profile: true } })
  if (!inst?.crmOrganizationId) return { error: 'Your workspace is not linked to its public page yet. Email support@launchyournextchapter.com and we will link it.', values }
  const parsed = parsePublicPageForm(formData)
  if (!parsed.ok) return { error: parsed.error, values }
  const profile = readProfile(inst.profile)
  const content = {
    ...parsed.content,
    imageUrl: profile.heroImageUrl ?? profile.photos?.[0]?.url ?? null,
    logoUrl: inst.logoUrl ?? null,
    tagline: profile.tagline ?? null,
  }
  const r = await savePublicPage({ crmOrgId: inst.crmOrganizationId, kind: orgKindOf(ctx.institution.orgType) === 'college' ? 'COLLEGE' : 'WORKFORCE', content, by: ctx.email ?? ctx.userId, distinctId: ctx.userId })
  return { ok: true, message: r.status === 'PUBLISHED' ? 'Saved and published. Your page shows it now.' : 'Saved. NextChapter reviews your first version, usually within a business day, and it shows on your page once approved.' }
}
