'use server'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { isUndeliverableAddress } from '@/lib/email/resend-client'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { sendResumeLeadConfirmationEmail } from '@/lib/email/send-resume-lead-confirmation'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'

// "Personalize" on an industry or job-title page: the visitor gives a state and an email, and may attach a résumé. It files the
// same ResumeSubmissionLead the homepage résumé form does (no AI, no parsing, so no per-use cost beyond storage and the one
// confirmation email when a file came with it). The page it came from goes in `source`; the state goes after the label.

export type FitLeadState = { error?: string; sent?: boolean; email?: string; hasFile?: boolean } | undefined

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCE = /^page:(industry|title):[a-z0-9-]{1,70}$/
const MAX_FILE_SIZE = 10 * 1024 * 1024
const text = (formData: FormData, k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

export async function submitFitLead(_prev: FitLeadState, formData: FormData): Promise<FitLeadState> {
  if (text(formData, 'website', 200)) return { sent: true }

  const email = text(formData, 'email', 200).toLowerCase()
  if (!EMAIL.test(email) || isUndeliverableAddress(email)) return { error: 'Enter a valid email address.', email }
  const state = text(formData, 'state', 2).toUpperCase()
  if (!ALL_STATE_CODES.includes(state)) return { error: 'Pick your state.', email }
  const sourceRaw = text(formData, 'source', 90)
  const source = SOURCE.test(sourceRaw) ? sourceRaw : 'page:unknown'
  const label = text(formData, 'label', 100)
  const pct = Number(text(formData, 'pct', 3))

  if (!(await allowByIp('fit-lead', 8, HOUR_MS))) return { error: RATE_LIMITED_MESSAGE, email }
  if (!(await allowByTarget('fit-lead-email', email, 3, DAY_MS))) return { error: 'We already have a few from that address today. Try again tomorrow.', email }

  const file = formData.get('file') as File | null
  let filePath: string | null = null
  let fileName: string | null = null
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) return { error: 'That file is too large. Use a résumé under 10 MB.', email }
    const check = await validateUpload(file, 'resume', MAX_FILE_SIZE)
    if (!check.ok) return { error: check.error, email }
    const path = `leads/${crypto.randomUUID()}.${check.ext}`
    const { error } = await createAdminClient().storage.from('resumes').upload(path, file, { contentType: check.contentType })
    if (error) return { error: 'Something went wrong uploading your file. Try again, or send the email without it.', email }
    filePath = path
    fileName = file.name
  }

  try {
    await prisma.resumeSubmissionLead.create({
      data: { fullName: email.split('@')[0].slice(0, 120), email, targetRole: `${label} · ${state}`.slice(0, 160), filePath, fileName, source },
    })
    notifyNewLead({ email, channel: 'Résumé gap check', detail: `${source} · ${stateName(state)}${filePath ? ' · résumé attached' : ''}` })
    if (filePath) await sendResumeLeadConfirmationEmail(email, email.split('@')[0])
    captureServerEvent(email, 'fit_lead_submitted', { source, state, hasFile: !!filePath, fitPct: Number.isFinite(pct) ? pct : null })
    return { sent: true, email, hasFile: !!filePath }
  } catch (error) {
    console.error('fit lead failed:', error instanceof Error ? error.message : error)
    return { error: 'Something went wrong. Try again in a minute.', email }
  }
}
