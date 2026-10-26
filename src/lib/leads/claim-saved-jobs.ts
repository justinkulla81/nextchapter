import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { upsertTracked } from '@/lib/jobs/change-status'

// Jobs saved on a public job page before the person had an account. They are kept two ways: the
// email they typed (HomepageLead rows, kind 'apply_save') and a cookie on this browser, so the
// job is found even when they sign up with a different address. Claimed once, when registration
// completes; failures never block registration.

export const SAVED_JOBS_COOKIE = 'nc_saved_jobs'
export const SAVED_JOBS_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const MAX_JOBS = 10

export function parseSavedJobsCookie(raw: string | undefined): string[] {
  if (!raw) return []
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{6,60}$/.test(s)))].slice(0, MAX_JOBS)
}

export function addToSavedJobsCookie(raw: string | undefined, jobId: string): string {
  return [jobId, ...parseSavedJobsCookie(raw).filter((id) => id !== jobId)].slice(0, MAX_JOBS).join(',')
}

export async function claimSavedJobs(candidateId: string, email: string | null): Promise<number> {
  const fromCookie = parseSavedJobsCookie((await cookies()).get(SAVED_JOBS_COOKIE)?.value)
  const fromEmail = email
    ? (await prisma.homepageLead.findMany({ where: { email: email.toLowerCase(), kind: 'apply_save' }, select: { searchQ: true }, take: 25 })).map((l) => l.searchQ)
    : []
  const ids = [...new Set([...fromCookie, ...fromEmail])].slice(0, 25)
  if (ids.length === 0) return 0

  const jobs = await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, companyName: true, url: true } })
  let claimed = 0
  for (const job of jobs) {
    const tracked = await upsertTracked(candidateId, { source: 'job_board', sourceId: job.id, title: job.title, companyName: job.companyName, url: job.url, workType: 'full_time' })
    await prisma.trackedJob.update({ where: { id: tracked.id }, data: { savedAt: tracked.savedAt ?? new Date() } })
    claimed++
  }
  if (claimed > 0) captureServerEvent(candidateId, 'saved_jobs_claimed', { count: claimed, fromCookie: fromCookie.length, fromEmail: fromEmail.length })
  return claimed
}
