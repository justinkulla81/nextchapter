'use server'

import { after } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { isUndeliverableAddress } from '@/lib/email/resend-client'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { extractResumeText } from '@/lib/resume/extract-text'
import { getPublicJob } from '@/lib/jobs/public-job-page-server'
import { matchResumeToJob, JOB_MIN_CHARS, RESUME_MIN_CHARS, TEXT_MAX_CHARS, type JobMatchResult } from '@/lib/tools/resume-job-match'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { addToSavedJobsCookie, SAVED_JOBS_COOKIE, SAVED_JOBS_MAX_AGE_SECONDS } from '@/lib/leads/claim-saved-jobs'
import { lifecycleEmailsOn } from '@/lib/leads/lifecycle/config'
import { fileLeadInCrm } from '@/lib/leads/lifecycle/file-lead'
import { sendLifecycleEmail } from '@/lib/leads/lifecycle/send'

// The résumé match box on public job pages, in the Apply prompt and on layoff company pages (owner decision 2026-11-18: ask for the
// résumé first, on the page, with the answer in seconds). Two steps:
//  1. scoreResumeForJob: the file is read on the server and compared with the posting by the same fixed rules as the free tool
//     (src/lib/tools/resume-job-match.ts). Nothing is stored and no model is called; the reply is the score and the terms.
//  2. saveResumeMatch: with an email, the file is stored as a ResumeSubmissionLead (the résumé), the job is saved for the address
//     (an apply_save lead, so the follow-up emails and the light account know it), and the welcome goes out at once with the match
//     in it. That welcome is logged as the lifecycle welcome, so the cron sends only the reminders after it.
// The account link travels only by email: putting it on the page would let anyone open an account under someone else's address.
// Data: one posting read by id (~5 KB) per score and per save; no lists.

export type ResumeMatchSummary = Pick<JobMatchResult, 'score' | 'band' | 'bandLabel' | 'compared' | 'titleInResume'> & {
  matched: string[]
  missing: { term: string; required: boolean }[]
}

export type ScoreState = { error?: string; result?: ResumeMatchSummary } | undefined
export type SaveMatchState = { error?: string; saved?: boolean; email?: string; result?: ResumeMatchSummary } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_FILE_SIZE = 10 * 1024 * 1024
const PLACEMENTS = ['job_top', 'apply_gate', 'layoff', 'exit'] as const
type Placement = (typeof PLACEMENTS)[number]
const GENERIC_ERROR = 'Something went wrong. Try again in a minute.'
const UNREADABLE = 'We could not read the text in that file. Try the Word version, or a PDF saved from Word or Google Docs (a scanned page has no text to read).'

const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)
const placementOf = (formData: FormData): Placement => {
  const p = text(formData, 'placement', 20)
  return (PLACEMENTS as readonly string[]).includes(p) ? (p as Placement) : 'job_top'
}

async function readResume(file: File | null): Promise<{ text: string; ext: string; contentType: string } | { error: string }> {
  if (!file || file.size === 0) return { error: 'Choose your résumé: a PDF or Word (.docx) file.' }
  const check = await validateUpload(file, 'resume', MAX_FILE_SIZE)
  if (!check.ok) return { error: check.error }
  const read = await extractResumeText(file, check.ext === 'pdf' ? 'pdf' : 'docx')
  const body = (read.text ?? '').replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX_CHARS)
  if (body.length < RESUME_MIN_CHARS) return { error: UNREADABLE }
  return { text: body, ext: check.ext, contentType: check.contentType }
}

async function jobFor(jobId: string) {
  const job = jobId ? await getPublicJob(jobId).catch(() => null) : null
  if (!job) return null
  const posting = `${job.title}\n${job.description ?? ''}`.slice(0, TEXT_MAX_CHARS)
  return posting.length >= JOB_MIN_CHARS ? { job, posting } : null
}

function summarize(r: JobMatchResult): ResumeMatchSummary {
  return {
    score: r.score,
    band: r.band,
    bandLabel: r.bandLabel,
    compared: r.compared,
    titleInResume: r.titleInResume,
    matched: r.matched.map((t) => t.term),
    // Required terms first: they come from the posting's requirements section.
    missing: [...r.missing].sort((a, b) => Number(b.required) - Number(a.required)).map((t) => ({ term: t.term, required: !!t.required })),
  }
}

export async function scoreResumeForJob(_prev: ScoreState, formData: FormData): Promise<ScoreState> {
  if (!(await allowByIp('resume-match', 30, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE }
  const found = await jobFor(text(formData, 'jobId', 60))
  if (!found) return { error: 'That job is no longer listed.' }
  const read = await readResume(formData.get('file') as File | null)
  if ('error' in read) return { error: read.error }
  return { result: summarize(matchResumeToJob(read.text, found.posting)) }
}

export async function saveResumeMatch(_prev: SaveMatchState, formData: FormData): Promise<SaveMatchState> {
  if (text(formData, 'website', 200)) return { saved: true }
  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email) || isUndeliverableAddress(email)) return { error: 'Enter a valid email address.', email }
  const placement = placementOf(formData)
  const jobId = text(formData, 'jobId', 60)
  const layoffSlug = text(formData, 'layoffSlug', 120)
  const layoffName = text(formData, 'layoffName', 160)

  if (!(await allowByIp('resume-match-save', 10, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE, email }
  if (!(await allowByTarget('resume-match-save', email, 5, DAY_MS))) return { error: 'We already have a few from that address today. Try again tomorrow.', email }

  const file = formData.get('file') as File | null
  const read = await readResume(file)
  if ('error' in read) return { error: read.error, email }
  const found = jobId ? await jobFor(jobId) : null
  if (jobId && !found) return { error: 'That job is no longer listed.', email }
  const result = found ? summarize(matchResumeToJob(read.text, found.posting)) : undefined
  const detail = found ? `${found.job.title} at ${found.job.companyName}` : null

  try {
    const path = `leads/${crypto.randomUUID()}.${read.ext}`
    const { error: uploadError } = await createAdminClient().storage.from('resumes').upload(path, file!, { contentType: read.contentType })
    if (uploadError) return { error: 'Something went wrong storing your résumé. Try again.', email }

    const source = found ? `resume_match:${placement}:${found.job.id}` : `resume_match:layoff:${layoffSlug || 'unknown'}`
    await prisma.resumeSubmissionLead.create({
      data: {
        fullName: email.split('@')[0].slice(0, 120),
        email,
        targetRole: (detail ?? (layoffName ? `Laid off from ${layoffName}` : null))?.slice(0, 160) ?? null,
        filePath: path,
        fileName: file!.name.slice(0, 200),
        source: source.slice(0, 120),
      },
    })

    const ip = await getClientIp()
    if (found) {
      // The job saved for the address, as "Save this job" does, so the account page and the follow-ups know it.
      const key = { email, kind: 'apply_save', situation: '', searchQ: found.job.id, searchLoc: '', searchRemote: false }
      await prisma.homepageLead.upsert({
        where: { email_kind_situation_searchQ_searchLoc_searchRemote: key },
        update: { unsubscribedAt: null },
        create: { ...key, source: 'job_page', followup: 'resume_match', ip },
      })
      try {
        const jar = await cookies()
        jar.set(SAVED_JOBS_COOKIE, addToSavedJobsCookie(jar.get(SAVED_JOBS_COOKIE)?.value, found.job.id), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: SAVED_JOBS_MAX_AGE_SECONDS })
      } catch {}
    } else {
      // A layoff page has no job: the address joins as a candidate waitlist lead, which the follow-up emails cover.
      await prisma.waitlistSignup.create({ data: { audience: 'layoff_resume', payload: { email, company: layoffName || null, slug: layoffSlug || null } } })
    }

    notifyNewLead({ email, channel: 'Résumé match', detail: detail ?? (layoffName ? `Laid off from ${layoffName}` : 'layoff page') })
    captureServerEvent(email, 'resume_match_saved', { placement, jobId: found?.job.id ?? null, company: found?.job.companyName ?? layoffName ?? null, layoffSlug: layoffSlug || null, score: result?.score ?? null, band: result?.band ?? null })

    // The welcome now, with the match in it, logged as the lifecycle welcome (after the reply, so the page does not wait on it).
    if (lifecycleEmailsOn()) {
      after(async () => {
        try {
          const personId = await fileLeadInCrm({ email, channel: found ? 'Saved job' : 'Waitlist', detail: detail ?? 'layoff_resume', capturedAt: new Date() })
          if (!personId) return
          await sendLifecycleEmail({
            email,
            variant: found ? 'saved_job' : 'waitlist',
            step: 'welcome',
            context: {
              firstName: null,
              detail,
              match: result ? { score: result.score, bandLabel: result.bandLabel, missing: result.missing.slice(0, 8).map((m) => m.term) } : null,
              layoffCompany: found ? null : layoffName || null,
            },
            jobId: found?.job.id ?? null,
            personId,
          })
        } catch (e) {
          console.error('resume match welcome failed:', e instanceof Error ? e.message : e)
        }
      })
    }
    return { saved: true, email, result }
  } catch (error) {
    console.error('resume match save failed:', error instanceof Error ? error.message : error)
    return { error: GENERIC_ERROR, email }
  }
}
