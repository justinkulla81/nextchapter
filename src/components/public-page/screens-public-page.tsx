// Admin › Public page (owner decision 2026-11-17): a paid college or workforce organization writes its own section on its
// public page. The free plan sees the locked card (GATED_SCREENS 'admin:publicpage').

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { orgKindOf } from '@/lib/higher-ed/workspaces'
import { editorStateFor } from '@/lib/public-page/store'
import { publicPageUrlFor } from '@/lib/public-page/where'
import { savePublicPageAction } from '@/app/i/[slug]/(portal)/public-page-actions'
import { PublicPageEditor } from './PublicPageEditor'

export async function AdminPublicPage({ ctx, base }: { ctx: WorkspaceContext; base: string }) {
  const inst = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { crmOrganizationId: true } })
  if (!inst?.crmOrganizationId) {
    return (
      <p className="max-w-2xl text-sm text-muted-foreground">
        Your workspace is not linked to its public page yet. Email support@launchyournextchapter.com and we will link it, then you can write your section here.
      </p>
    )
  }
  const [state, url] = await Promise.all([editorStateFor(inst.crmOrganizationId), publicPageUrlFor(inst.crmOrganizationId)])
  return (
    <PublicPageEditor
      kind={orgKindOf(ctx.institution.orgType) === 'college' ? 'COLLEGE' : 'WORKFORCE'}
      draft={state?.draft ?? null}
      status={state?.status ?? null}
      reviewNote={state?.reviewNote ?? null}
      firstApproved={state?.firstApproved ?? false}
      pageUrls={url ? [url] : []}
      picturesHref={`${base}/branding`}
      action={savePublicPageAction.bind(null, ctx.institution.slug)}
    />
  )
}
