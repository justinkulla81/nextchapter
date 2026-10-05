'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { INTAKE_MAX_FILE_BYTES } from '@/lib/recruiter/intake/constants'
import { ingestIntake, intakeFileType, processIntakeResume, sendSubmissionConfirmation } from '@/lib/recruiter/intake/pipeline'

export type InboundFormState = { error?: string; sent?: boolean; firstName?: string } | undefined

const MAX_SUBMISSIONS_PER_DAY = 3

export async function submitInbound(_prev: InboundFormState, formData: FormData): Promise<InboundFormState> {
  // Honeypot: real people never see or fill this field.
  if ((formData.get('website') as string | null)?.trim()) return { sent: true }

  const firmSlug = String(formData.get('firmSlug') ?? '')
  const recruiterSlug = String(formData.get('recruiterSlug') ?? '') || null
  const notFit = formData.get('nf') === '1'
  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const linkedinUrl = String(formData.get('linkedinUrl') ?? '').trim() || null
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null
  const consentScopes = formData.getAll('consent').map(String)
  const file = formData.get('file') as File | null

  if (!fullName) return { error: 'Enter your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (!file || file.size === 0) return { error: 'Attach your resume.' }
  if (file.size > INTAKE_MAX_FILE_BYTES) return { error: 'That file is over 10 MB. Please upload a smaller PDF or Word file.' }
  if (!intakeFileType(file.name)) return { error: 'Please upload a PDF or Word (.docx) file.' }

  const firm = await prisma.recruiterFirm.findUnique({ where: { slug: firmSlug } })
  if (!firm || firm.status !== 'VERIFIED') return { error: 'This page is not accepting resumes right now.' }
  const recruiter = recruiterSlug
    ? await prisma.recruiter.findFirst({ where: { recruiterFirmId: firm.id, intakeSlug: recruiterSlug, firmRole: { in: ['ADMIN', 'RECRUITER'] } } })
    : null
  if (recruiterSlug && !recruiter) return { error: 'This page is not accepting resumes right now.' }

  const recent = await prisma.intakeResume.count({
    where: { firmId: firm.id, intakeCandidate: { email }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  })
  if (recent >= MAX_SUBMISSIONS_PER_DAY) {
    return { error: `${firm.name} already has your resume from today. Try again tomorrow if you need to send a new version.` }
  }

  const headerList = await headers()
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const result = await ingestIntake({
    firm,
    recruiter,
    source: notFit ? 'NOT_FIT_LINK' : 'PAGE',
    entryPoint: recruiter ? 'PERSONAL_PAGE' : 'FIRM_PAGE',
    person: { fullName, email, linkedinUrl, note },
    file: { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, contentType: file.type || null },
    consentScopes,
    ip,
  })
  if (!result.ok) return { error: result.message }

  // Parse/tag/route (one Haiku call) and the confirmation email run after
  // the response so the candidate isn't kept waiting.
  after(async () => {
    try {
      await processIntakeResume(result.resumeId)
    } catch (error) {
      console.error('Talent intake processing failed:', error)
    }
    await sendSubmissionConfirmation(result.connectionId)
  })

  captureServerEvent(result.intakeCandidateId, 'talent_inbound_page_submitted', {
    firmId: firm.id,
    recruiterId: recruiter?.id ?? null,
    notFitLink: notFit,
    consentScopeCount: consentScopes.length,
    hasLinkedin: !!linkedinUrl,
    hasNote: !!note,
  })

  return { sent: true, firstName: fullName.split(/\s+/)[0] }
}
