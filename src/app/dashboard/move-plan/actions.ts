'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardProfile, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { acceptPartnerInvite, endPartnership, invitePartner, updateSharing } from '@/lib/partner-search/partner'
import { addPlace, removePlace } from '@/lib/partner-search/move-plan'

type State = { ok?: boolean; error?: string } | null

function refresh() {
  revalidatePath('/dashboard/move-plan')
  revalidatePath('/dashboard/supporters')
}

export async function addPlaceAction(metroCode: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await getDashboardProfile()
  const r = await addPlace(profile.id, metroCode)
  if (r.ok) refresh()
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

export async function removePlaceAction(placeId: string) {
  const profile = await getDashboardProfile()
  await removePlace(profile.id, placeId)
  refresh()
}

// Asked only where it explains a comparison (the move plan, a job's pay, a pivot role's pay), never as a stand-alone form.
const ASK_SOURCES = ['move_plan', 'job_detail', 'pivot'] as const
export async function saveLastSalaryAction(_prev: State, formData: FormData): Promise<State> {
  const profile = await getDashboardProfile()
  const digits = String(formData.get('salary') ?? '').replace(/[^0-9]/g, '')
  const n = Number(digits)
  // "120" and "120k" mean thousands; a full amount is kept as typed to the nearest thousand.
  const lastSalary = n >= 1000 ? Math.round(n / 1000) * 1000 : n * 1000
  if (!digits || lastSalary < 10_000 || lastSalary > 5_000_000) return { error: 'Enter your yearly pay before taxes, like 120,000.' }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { lastSalary, salaryConfirmedAt: new Date() } })
  const sent = String(formData.get('source') ?? '')
  const source = ASK_SOURCES.find((s) => s === sent) ?? 'move_plan'
  const contextId = String(formData.get('contextId') ?? '').slice(0, 80) || null
  captureServerEvent(profile.id, 'last_salary_added', { source, contextId })
  revalidatePath('/dashboard/move-plan')
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard/jobs/[id]', 'page')
  revalidatePath('/dashboard/pivot-paths')
  revalidatePath('/dashboard/market-reality')
  return { ok: true }
}

export async function invitePartnerAction(_prev: State, formData: FormData): Promise<State> {
  const profile = await getDashboardProfile()
  const user = await getVerifiedSessionUser()
  const r = await invitePartner(profile.id, user?.email ?? null, String(formData.get('name') ?? ''), String(formData.get('email') ?? ''), {
    sharePlaces: formData.get('sharePlaces') !== 'no',
    shareJobsPay: formData.get('shareJobsPay') !== 'no',
  })
  if (r.ok) refresh()
  return r.ok ? { ok: true } : { error: r.error }
}

export async function acceptInviteAction(linkId: string): Promise<State> {
  const profile = await getDashboardProfile()
  const user = await getVerifiedSessionUser()
  const verified = !!user?.email_confirmed_at
  const r = await acceptPartnerInvite(profile.id, verified ? user?.email : null, linkId)
  if (r.ok) refresh()
  return r.ok ? { ok: true } : { error: verified ? r.error : 'Confirm your email address first, then accept.' }
}

export async function endPartnershipAction(linkId: string) {
  const profile = await getDashboardProfile()
  await endPartnership(profile.id, linkId)
  refresh()
}

export async function updateSharingAction(linkId: string, sharePlaces: boolean, shareJobsPay: boolean) {
  const profile = await getDashboardProfile()
  await updateSharing(profile.id, linkId, { sharePlaces, shareJobsPay })
  refresh()
}
