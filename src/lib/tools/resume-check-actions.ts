'use server'

import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { analyzeResume, teaserFor, RESUME_MAX_CHARS, RESUME_MIN_CHARS, type ResumeFinding, type ResumeTeaser } from '@/lib/tools/resume-check'

// The résumé check on /tools/resume-check: pasted text in, a score out, no AI and no cost per check. The score and the
// number of fixes show first; the fixes themselves unlock once the person leaves an email, which puts them on the lead
// path (the "which sounds most like you" question). The résumé text is read in memory and never stored or logged; the
// lead row keeps the email and the score band only. No email is sent from here.

export interface ResumeCheckState {
  error?: string
  teaser?: ResumeTeaser
  /** After the email box: the full list, and the token that ties the journey choice to this person. */
  findings?: ResumeFinding[]
  token?: string
  email?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function runResumeCheck(_prev: ResumeCheckState | undefined, formData: FormData): Promise<ResumeCheckState> {
  const resume = text(formData, 'resume', RESUME_MAX_CHARS + 1)
  if (resume.length < RESUME_MIN_CHARS) return { error: 'Paste your whole résumé as text, at least a few paragraphs, so there is enough to read.' }
  if (resume.length > RESUME_MAX_CHARS) return { error: 'That is too long for a résumé. Paste two pages or less.' }
  if (!(await allowByIp('resume-check', 40, HOUR_MS))) return { error: 'Too many checks from this network. Try again later.' }
  const r = analyzeResume(resume)
  if (!r) return { error: 'Something went wrong. Try again.' }
  // No person is identified at this step, so each check gets its own throwaway id.
  captureServerEvent(`resume-check-${crypto.randomUUID()}`, 'resume_check_run', { score: r.score, band: r.band, wordCount: r.wordCount, issueCount: r.issueCount })
  return { teaser: teaserFor(r) }
}

export async function emailResumeCheck(prev: ResumeCheckState | undefined, formData: FormData): Promise<ResumeCheckState> {
  const base: ResumeCheckState = { teaser: prev?.teaser }
  // A filled honeypot gets a quiet, empty answer: nothing saved and nothing unlocked.
  if (text(formData, 'website', 200)) return { ...base, error: 'Something went wrong. Try again.' }
  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email)) return { ...base, error: 'Enter a valid email address.', email }
  const r = analyzeResume(text(formData, 'resume', RESUME_MAX_CHARS + 1))
  if (!r) return { ...base, error: 'Run the check again, then unlock the fixes.', email }
  if (!(await allowByIp('resume-check-email', 10, HOUR_MS)) || !(await allowByTarget('resume-check-email', email, 5, DAY_MS))) {
    return { ...base, error: 'Too many requests from this network. Try again later.', email }
  }
  try {
    const ip = await getClientIp()
    const key = { email, kind: 'resume_check', situation: '', searchQ: '', searchLoc: '', searchRemote: false }
    const select = { id: true, unsubscribeToken: true } as const
    const existing = await prisma.homepageLead.findUnique({ where: { email_kind_situation_searchQ_searchLoc_searchRemote: key }, select })
    // Only the score band is kept, never the résumé. A returning address updates its band and nothing else, so a person
    // who unsubscribed is not signed back up.
    const lead = existing
      ? await prisma.homepageLead.update({ where: { id: existing.id }, data: { followup: r.band }, select })
      : await prisma.homepageLead.create({ data: { ...key, source: 'resume_check', followup: r.band, ip }, select })
    captureServerEvent(email, 'lead_captured', { kind: 'resume_check', source: 'resume_check', score: r.score, band: r.band, returning: !!existing })
    return { ...base, findings: r.findings, token: lead.unsubscribeToken, email }
  } catch (error) {
    console.error('resume check lead failed:', error instanceof Error ? error.message : error)
    return { ...base, error: 'Something went wrong. Try again in a minute.', email }
  }
}
