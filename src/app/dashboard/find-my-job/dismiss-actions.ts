'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import {
  FLAG_REASONS,
  parseDismissReasons,
  preferenceChanges,
  type DismissReason,
  type PreferenceChange,
} from '@/lib/jobs/job-dismiss'

// Passing on a board job with reasons (job-dismiss.ts), its undo, and the member's answers
// to "Hide all X?". The job is marked on the existing TrackedJob row ("Not interested",
// which also hides it from My jobs); what it teaches goes to JobDismissPreference.

const NOTE_MAX = 500

async function currentCandidateId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

export interface DismissResult {
  ok: boolean
  /** What the board now does differently, for the card's confirmation ("Hid Acme"). */
  applied: { kind: PreferenceChange['kind']; label: string; action: PreferenceChange['action'] }[]
}

function postingFacts(p: { companyName: string; title: string; level: string | null; location: string | null; industry: string | null; salaryMin: number | null; salaryMax: number | null }) {
  const bucket = normalizeIndustryBucket(p.industry)
  return { ...p, industry: bucket && bucket !== 'Other' ? bucket : null }
}

export async function dismissBoardJob(jobId: string, rawReasons: string[], note?: string | null): Promise<DismissResult> {
  const candidateId = await currentCandidateId()
  if (!candidateId || typeof jobId !== 'string') return { ok: false, applied: [] }
  const reasons = parseDismissReasons(rawReasons)
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, NOTE_MAX) : null
  const posting = await prisma.exclusiveJobPosting.findUnique({
    where: { id: jobId },
    select: { id: true, title: true, companyName: true, url: true, level: true, location: true, industry: true, salaryMin: true, salaryMax: true },
  })
  if (!posting) return { ok: false, applied: [] }

  const now = new Date()
  await prisma.trackedJob.upsert({
    where: { candidateId_source_sourceId: { candidateId, source: 'job_board', sourceId: jobId } },
    create: {
      candidateId,
      source: 'job_board',
      sourceId: jobId,
      title: posting.title,
      companyName: posting.companyName,
      url: posting.url,
      dismissedAt: now,
      dismissReasons: reasons,
      dismissNote: cleanNote,
    },
    update: { dismissedAt: now, savedAt: null, dismissReasons: reasons, dismissNote: cleanNote },
  })

  const changes = preferenceChanges(reasons, postingFacts(posting))
  for (const c of changes) {
    const existing = await prisma.jobDismissPreference.findUnique({ where: { candidateId_kind_value: { candidateId, kind: c.kind, value: c.value } } })
    const revived = !existing || existing.undoneAt !== null
    await prisma.jobDismissPreference.upsert({
      where: { candidateId_kind_value: { candidateId, kind: c.kind, value: c.value } },
      create: { candidateId, kind: c.kind, value: c.value, label: c.label, count: 1, action: c.action },
      update: {
        label: c.label,
        count: revived ? 1 : { increment: 1 },
        undoneAt: null,
        // A "Hide all" the member already chose stays; a revived one starts over.
        ...(revived || c.action !== 'downweight' ? { action: c.action } : {}),
      },
    })
    if (c.action !== 'downweight') captureServerEvent(candidateId, 'dismiss_preference_applied', { kind: c.kind, action: c.action, source: 'dismiss' })
  }

  const flags = reasons.filter((r): r is DismissReason => FLAG_REASONS.includes(r))
  for (const kind of flags) {
    await prisma.jobPostingFlag.upsert({
      where: { postingId_candidateId_kind: { postingId: jobId, candidateId, kind } },
      create: { postingId: jobId, candidateId, kind, note: cleanNote },
      update: { note: cleanNote },
    })
  }
  // The card hides itself; the next board load leaves the job out. No page re-render here.
  return { ok: true, applied: changes.filter((c) => c.action !== 'downweight').map((c) => ({ kind: c.kind, label: c.label, action: c.action })) }
}

/** Undo a dismissal: the job comes back, and what that dismissal taught is taken back. */
export async function undoDismissBoardJob(jobId: string): Promise<{ ok: boolean }> {
  const candidateId = await currentCandidateId()
  if (!candidateId || typeof jobId !== 'string') return { ok: false }
  const tracked = await prisma.trackedJob.findUnique({
    where: { candidateId_source_sourceId: { candidateId, source: 'job_board', sourceId: jobId } },
  })
  if (!tracked?.dismissedAt) return { ok: true }
  const posting = await prisma.exclusiveJobPosting.findUnique({
    where: { id: jobId },
    select: { title: true, companyName: true, level: true, location: true, industry: true, salaryMin: true, salaryMax: true },
  })
  const now = new Date()
  if (posting) {
    for (const c of preferenceChanges(parseDismissReasons(tracked.dismissReasons), postingFacts(posting))) {
      const pref = await prisma.jobDismissPreference.findUnique({ where: { candidateId_kind_value: { candidateId, kind: c.kind, value: c.value } } })
      if (!pref || pref.undoneAt) continue
      const count = Math.max(0, pref.count - 1)
      await prisma.jobDismissPreference.update({
        where: { id: pref.id },
        data: { count, ...(c.action !== 'downweight' || count === 0 ? { undoneAt: now } : {}) },
      })
    }
  }
  await prisma.jobPostingFlag.deleteMany({ where: { postingId: jobId, candidateId, reviewedAt: null } })
  await prisma.trackedJob.update({ where: { id: tracked.id }, data: { dismissedAt: null, dismissReasons: [], dismissNote: null } })
  captureServerEvent(candidateId, 'dismiss_undone', { jobId, scope: 'job' })
  return { ok: true }
}

/** "Hide all X?" answered ('hide' | 'keep'), or a learned preference undone ('undo'). */
export async function decideDismissPreference(preferenceId: string, decision: 'hide' | 'keep' | 'undo'): Promise<{ ok: boolean }> {
  const candidateId = await currentCandidateId()
  if (!candidateId || !['hide', 'keep', 'undo'].includes(decision)) return { ok: false }
  const pref = await prisma.jobDismissPreference.findFirst({ where: { id: preferenceId, candidateId } })
  if (!pref) return { ok: false }
  const now = new Date()
  if (decision === 'hide') {
    await prisma.jobDismissPreference.update({ where: { id: pref.id }, data: { action: 'hide', askedAt: now } })
    captureServerEvent(candidateId, 'dismiss_preference_applied', { kind: pref.kind, action: 'hide', source: 'ask' })
  } else if (decision === 'keep') {
    await prisma.jobDismissPreference.update({ where: { id: pref.id }, data: { askedAt: now } })
  } else {
    await prisma.jobDismissPreference.update({ where: { id: pref.id }, data: { undoneAt: now } })
    captureServerEvent(candidateId, 'dismiss_undone', { kind: pref.kind, scope: 'preference' })
  }
  revalidatePath('/dashboard/find-my-job')
  return { ok: true }
}
