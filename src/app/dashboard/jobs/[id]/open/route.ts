import { after, NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { checkPostingLive, VERIFY_FRESH_MS } from '@/lib/jobs/liveness'
import { archiveDeadPostings, closeOpeningsQuietly } from '@/lib/jobs/liveness-store'

// "View posting" / apply on a board job goes through here (opened in a new tab). When the
// posting hasn't been verified live in the last 24 hours, one fast check (liveness.ts,
// 2.5 s) runs first: dead → the job is archived (closeReason 'expired_checked') and the
// member lands on its page, which says "This job just closed" and shows similar live
// jobs, instead of the employer's dead page. Live, unclear or timed out → straight on.

export const maxDuration = 15

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const posting = await prisma.exclusiveJobPosting.findUnique({
    where: { id },
    select: { id: true, url: true, title: true, companyName: true, location: true, archivedAt: true, lastVerifiedAt: true, source: true, sourceName: true, sourceCategory: true },
  })
  if (!posting?.url) return NextResponse.redirect(new URL('/dashboard/find-my-job', request.url))
  const jobPage = new URL(`/dashboard/jobs/${posting.id}?src=closed_on_click`, request.url)
  if (posting.archivedAt) return NextResponse.redirect(jobPage)

  const fresh = posting.lastVerifiedAt && Date.now() - posting.lastVerifiedAt.getTime() < VERIFY_FRESH_MS
  if (fresh || posting.source !== 'ats_feed') return NextResponse.redirect(posting.url)

  const result = await checkPostingLive(posting)
  const now = new Date()
  if (result.status === 'dead') {
    await archiveDeadPostings({ ids: [posting.id] }, now)
    after(closeOpeningsQuietly)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const profile = user ? await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : null
    captureServerEvent(profile?.id ?? user?.id ?? 'anonymous', 'job_link_dead_on_click', {
      jobId: posting.id,
      source: posting.sourceName ?? posting.sourceCategory ?? posting.source,
      sourceCategory: posting.sourceCategory,
      reason: result.note,
    })
    return NextResponse.redirect(jobPage)
  }
  if (result.status === 'live') {
    await prisma.exclusiveJobPosting.update({ where: { id: posting.id }, data: { lastVerifiedAt: now } }).catch(() => {})
  }
  return NextResponse.redirect(posting.url)
}
