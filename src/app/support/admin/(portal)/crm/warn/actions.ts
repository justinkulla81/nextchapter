'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { promoteWarnNoticeById, syncAllWarnStates } from '@/lib/warn/sync'
import { matchOrCreateCompanyForEmployer } from '@/lib/warn/company-match'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const BASE = '/support/admin/crm/warn'

/** Turns staged notices into outplacement leads. */
export async function promoteNotices(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return { message: 'Nothing selected.' }

  let promoted = 0
  for (const id of ids) {
    if (await promoteWarnNoticeById(id)) promoted++
  }
  captureServerEvent(admin.email ?? 'admin', 'warn_notices_promoted', { count: promoted })
  revalidatePath(BASE)
  revalidatePath('/support/admin/crm/leads')
  return { message: `Created ${promoted} ${promoted === 1 ? 'lead' : 'leads'}.` }
}

/** Marks notices as reviewed and not worth pursuing. */
export async function dismissNotices(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  const reason = String(formData.get('reason') ?? '').trim() || 'Not our market'
  if (ids.length === 0) return { message: 'Nothing selected.' }

  const r = await prisma.warnNotice.updateMany({
    where: { id: { in: ids }, promotedAt: null },
    data: { dismissedAt: new Date(), dismissReason: reason },
  })
  captureServerEvent(admin.email ?? 'admin', 'warn_notices_dismissed', { count: r.count, reason })
  revalidatePath(BASE)
  return { message: `Dismissed ${r.count}. They will not come back on the next sync.` }
}

/**
 * Records a layoff the admin heard about from a news article rather than a
 * WARN filing — most real announcements (a CEO earnings call, a press
 * release) never trigger one, or won't for months. This is a lead source in
 * its own right, so it lands in the same review queue as a synced notice.
 */
export async function addManualLayoffNotice(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin()
  const companyName = String(formData.get('companyName') ?? '').trim()
  const employeesRaw = String(formData.get('employees') ?? '').trim()
  const articleUrl = String(formData.get('articleUrl') ?? '').trim()
  const noticeDateRaw = String(formData.get('noticeDate') ?? '').trim()

  if (!companyName) return { error: 'Company name is required.' }
  if (!articleUrl) return { error: 'A link to the supporting article is required.' }

  const employees = employeesRaw ? parseInt(employeesRaw, 10) : null
  const noticeDate = noticeDateRaw ? new Date(noticeDateRaw) : new Date()

  const match = await matchOrCreateCompanyForEmployer(companyName)

  await prisma.warnNotice.create({
    data: {
      employer: companyName,
      normalizedEmployer: normalizeOrgName(companyName),
      source: 'MANUAL_ANNOUNCEMENT',
      noticeDate,
      employees: Number.isFinite(employees) ? employees : null,
      sourceUrl: articleUrl,
      companyId: match.companyId,
      companyMatchStatus: match.status,
      ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}),
    },
  })

  captureServerEvent(admin.email ?? 'admin', 'warn_manual_notice_added', { companyName, employees, matchStatus: match.status })
  revalidatePath(BASE)
  return {
    message:
      match.status === 'AMBIGUOUS'
        ? `Added ${companyName} — couldn't tell if it's the same company as an existing one, so it's in "To review."`
        : `Added ${companyName}.`,
  }
}

/** Links an AMBIGUOUS notice to the company the admin confirms is the same one. */
export async function resolveWarnCompanyMatch(noticeId: string, companyId: string): Promise<void> {
  await requireAdmin()
  await prisma.warnNotice.update({
    where: { id: noticeId },
    data: { companyId, companyMatchStatus: 'MATCHED', companyMatchCandidates: Prisma.JsonNull },
  })
  revalidatePath(BASE)
}

/** Confirms an AMBIGUOUS notice's employer is NOT any of the candidates — creates a new Company instead. */
export async function createNewCompanyForNotice(noticeId: string): Promise<void> {
  await requireAdmin()
  const notice = await prisma.warnNotice.findUniqueOrThrow({ where: { id: noticeId }, select: { employer: true } })
  const cleanName = notice.employer.replace(/\s*\([^)]*\)\s*$/, '').trim() || notice.employer
  const company = await prisma.company.upsert({
    where: { canonicalNameNormalized: normalizeOrgName(cleanName) },
    update: {},
    create: { name: cleanName, canonicalNameNormalized: normalizeOrgName(cleanName) },
  })
  await prisma.warnNotice.update({
    where: { id: noticeId },
    data: { companyId: company.id, companyMatchStatus: 'MATCHED', companyMatchCandidates: Prisma.JsonNull },
  })
  revalidatePath(BASE)
}

/** Marks (or unmarks) a company as one we actively want to approach. */
export async function toggleCompanyPriority(companyId: string, isPriority: boolean): Promise<void> {
  const admin = await requireAdmin()
  await prisma.company.update({ where: { id: companyId }, data: { isPriority } })
  captureServerEvent(admin.email ?? 'admin', 'warn_company_priority_toggled', { companyId, isPriority })
  revalidatePath(BASE)
}

/** Records the CHRO (or VP People) contact someone tracked down for a company. */
export async function updateCompanyChroContact(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin()
  const companyId = String(formData.get('companyId') ?? '')
  const chroName = String(formData.get('chroName') ?? '').trim()
  const chroEmail = String(formData.get('chroEmail') ?? '').trim()
  const chroLinkedinUrl = String(formData.get('chroLinkedinUrl') ?? '').trim()
  if (!companyId) return { error: 'Missing company.' }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      chroName: chroName || null,
      chroEmail: chroEmail || null,
      chroLinkedinUrl: chroLinkedinUrl || null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'warn_company_chro_contact_saved', { companyId })
  revalidatePath(BASE)
  return { message: 'Saved.' }
}

/** Runs the sync now rather than waiting for Monday. */
export async function runWarnSyncNow(): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const results = await syncAllWarnStates(true)
  captureServerEvent(admin.email ?? 'admin', 'warn_sync_manual', { states: results.length })
  revalidatePath(BASE)
  const parts = results.map((r) =>
    r.error ? `${r.state}: ${r.error}` : `${r.state}: ${r.created} new, ${r.promoted} promoted, ${r.needsReview} to review`
  )
  return { message: parts.join(' · ') }
}
