'use server'

// The alum's own actions in the Candidate workspace (HE-06): sharing
// choices, "I'm in transition", "I got a job". Each acts only on the signed-in
// person's own membership at this college.

import { revalidatePath } from 'next/cache'
import type { InstitutionConsentScope } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { setConsent } from '@/lib/higher-ed/join'
import { closeTransitionFlag, graceDaysFrom, openTransitionFlag, reportNewJob } from '@/lib/higher-ed/transition'
import { captureServerEvent } from '@/lib/posthog/server'

const SCOPES: InstitutionConsentScope[] = ['SHARE_ENGAGEMENT', 'SHARE_OUTCOME', 'SHARE_SEARCH_DETAIL_WITH_CAREER', 'SHARE_DOSSIER_WITH_EMPLOYERS']
const PREVIEW = 'This is a preview: there’s no member record behind it, so nothing was saved.'

async function me(slug: string) {
  const ctx = await requireWorkspace(slug, 'candidate')
  if (!ctx.memberId) return { ctx, member: null }
  const member = await prisma.institutionMember.findUnique({
    where: { id: ctx.memberId },
    select: { id: true, candidateId: true, institution: { select: { enabledFeatures: true } } },
  })
  return { ctx, member }
}

export async function setMyConsent(slug: string, scope: string, granted: boolean): Promise<{ error?: string }> {
  if (!SCOPES.includes(scope as InstitutionConsentScope)) return { error: 'Unknown setting. Reload the page.' }
  const { ctx, member } = await me(slug)
  if (!member) return { error: PREVIEW }
  await setConsent(member.id, scope as InstitutionConsentScope, granted)
  captureServerEvent(ctx.userId, 'he_consent_changed', { institutionId: ctx.institution.id, scope, granted })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return {}
}

export async function markInTransition(slug: string): Promise<{ error?: string }> {
  const { ctx, member } = await me(slug)
  if (!member) return { error: PREVIEW }
  const r = await openTransitionFlag(member.id, 'SELF_REPORTED')
  if (r.created) captureServerEvent(ctx.userId, 'he_transition_reported', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}

export async function closeMyTransition(slug: string): Promise<{ error?: string }> {
  const { ctx, member } = await me(slug)
  if (!member) return { error: PREVIEW }
  if (await closeTransitionFlag(member.id)) captureServerEvent(ctx.userId, 'he_transition_closed', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}

export type JobFormState = { error?: string; ok?: boolean } | null

export async function reportMyJob(slug: string, _prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const { ctx, member } = await me(slug)
  if (!member?.candidateId) return { error: PREVIEW }
  const companyName = String(formData.get('companyName') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const start = String(formData.get('startDate') ?? '').trim()
  if (!companyName || !title) return { error: 'Add the employer and your title.' }
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(`${start}T00:00:00Z`) : null
  const helped = formData.get('helped')
  const r = await reportNewJob({
    memberId: member.id,
    candidateId: member.candidateId,
    companyName,
    title,
    startDate,
    helpedByInstitution: helped === 'yes' ? true : helped === 'no' ? false : null,
    shareMilestone: formData.get('shareMilestone') === 'on',
    graceDays: graceDaysFrom(member.institution.enabledFeatures),
  })
  captureServerEvent(ctx.userId, 'he_new_job_reported', {
    institutionId: ctx.institution.id,
    outcomeReportId: r.outcomeReportId,
    helped: helped ?? null,
    flagMoved: r.flagMoved,
  })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}
