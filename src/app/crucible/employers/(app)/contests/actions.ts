'use server'

import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { getCrucibleEmployerDashboardData } from '@/lib/crucible/employers/get-employer-dashboard-data'
import { notifyEligibleCandidatesForContest } from '@/lib/crucible/employers/notify-contest'
import type { CrucibleFunctionInterest } from '@prisma/client'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'csv', 'xlsx', 'txt']

export type CreateContestState = { error?: string } | undefined

export async function createCrucibleContest(
  _prevState: CreateContestState,
  formData: FormData
): Promise<CreateContestState> {
  const employer = await getCrucibleEmployerDashboardData()

  const title = (formData.get('title') as string | null)?.trim()
  const businessProblem = (formData.get('businessProblem') as string | null)?.trim()
  const targetFunctionRaw = formData.get('targetFunction') as string | null
  const targetFunction = targetFunctionRaw && targetFunctionRaw !== 'ALL' ? (targetFunctionRaw as CrucibleFunctionInterest) : null
  const file = formData.get('referenceFile') as File | null

  if (!title || !businessProblem) {
    return { error: 'Title and business problem are required.' }
  }

  let referenceFilePath: string | null = null
  let referenceFileName: string | null = null

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return { error: 'Reference file is too large — please upload a file under 10MB.' }
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return { error: 'Please upload a PDF, DOCX, CSV, XLSX, or TXT file.' }
    }

    const path = `contests/${crypto.randomUUID()}/${crypto.randomUUID()}.${ext}`
    const admin = createAdminClient()
    const { error } = await admin.storage
      .from('crucible-contest-files')
      .upload(path, file, { contentType: file.type || undefined })
    if (!error) {
      referenceFilePath = admin.storage.from('crucible-contest-files').getPublicUrl(path).data.publicUrl
      referenceFileName = file.name
    }
  }

  const contest = await prisma.crucibleContest.create({
    data: {
      employerId: employer.id,
      title,
      businessProblem,
      referenceFilePath,
      referenceFileName,
      targetFunction,
    },
  })

  captureServerEvent(employer.userId, 'crucible_contest_created', {
    contestId: contest.id,
    hasReferenceFile: !!referenceFilePath,
    targetFunction,
  })

  redirect(`/crucible/employers/contests/${contest.id}`)
}

async function requireOwnedContest(contestId: string, employerId: string) {
  const contest = await prisma.crucibleContest.findUnique({ where: { id: contestId } })
  if (!contest || contest.employerId !== employerId) notFound()
  return contest
}

export async function publishCrucibleContest(contestId: string): Promise<void> {
  const employer = await getCrucibleEmployerDashboardData()
  const contest = await requireOwnedContest(contestId, employer.id)
  if (contest.state !== 'DRAFT') return

  await prisma.crucibleContest.update({
    where: { id: contest.id },
    data: { state: 'OPEN', publishedAt: new Date() },
  })

  const { sent } = await notifyEligibleCandidatesForContest(contest.id)
  captureServerEvent(employer.userId, 'crucible_contest_notification_sent', {
    contestId: contest.id,
    notifiedCount: sent,
  })

  revalidatePath(`/crucible/employers/contests/${contest.id}`)
}

export async function closeCrucibleContest(contestId: string): Promise<void> {
  const employer = await getCrucibleEmployerDashboardData()
  const contest = await requireOwnedContest(contestId, employer.id)
  if (contest.state !== 'OPEN') return

  await prisma.crucibleContest.update({
    where: { id: contest.id },
    data: { state: 'CLOSED', closedAt: new Date() },
  })

  revalidatePath(`/crucible/employers/contests/${contest.id}`)
}

export async function toggleCrucibleContestEntryShortlist(entryId: string): Promise<void> {
  const employer = await getCrucibleEmployerDashboardData()
  const entry = await prisma.crucibleContestEntry.findUnique({
    where: { id: entryId },
    include: { contest: true },
  })
  if (!entry || entry.contest.employerId !== employer.id) notFound()

  const shortlisted = !entry.shortlisted
  await prisma.crucibleContestEntry.update({
    where: { id: entry.id },
    data: { shortlisted, shortlistedAt: shortlisted ? new Date() : null },
  })

  captureServerEvent(employer.userId, 'crucible_contest_entry_shortlisted', {
    contestId: entry.contestId,
    entryId: entry.id,
    shortlisted,
  })

  revalidatePath(`/crucible/employers/contests/${entry.contestId}`)
}
