'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { validateEmployerRegistration } from '@/lib/employer-references/submission'
import { parseReferenceFormData } from '@/lib/references/parse-reference-form'
import { sendLayoffContextAlertEmail } from '@/lib/email/send-layoff-context-alert'
import EmployerReferenceInviteEmail from '@/emails/employer-reference-invite'
import { Resend } from 'resend'
import type { ReferenceFormState } from '@/components/references/ReferenceSubmissionForm'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

async function sendInviteEmail(input: {
  managerName: string
  managerCompany: string
  employeeName: string
  employeeEmail: string
  inviteToken: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping employer reference invite email.')
    return
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: input.employeeEmail,
      subject: `${input.managerName} left you a reference on NextChapter`,
      react: EmployerReferenceInviteEmail({
        managerName: input.managerName,
        managerCompany: input.managerCompany,
        employeeFirstName: input.employeeName.split(' ')[0] || input.employeeName,
        claimUrl: `${APP_URL}/claim-reference/${input.inviteToken}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send employer reference invite email:', error)
  }
}

// Prompt 65 section 1's consent gate starts here: this creates an
// EmployerReferenceSubmission, never a Reference — nothing here is
// queryable by Dossier/Coaching Notes/anywhere else in the app until the
// invited candidate explicitly claims it (see claim-reference/[token]/actions.ts).
export async function submitEmployerReference(
  _prevState: ReferenceFormState,
  formData: FormData
): Promise<ReferenceFormState> {
  const submitterName = (formData.get('submitterName') as string | null)?.trim() ?? ''
  const submitterTitle = (formData.get('submitterTitle') as string | null)?.trim() || null
  const submitterCompany = (formData.get('submitterCompany') as string | null)?.trim() ?? ''
  const submitterEmail = (formData.get('submitterEmail') as string | null)?.trim() ?? ''
  const employeeName = (formData.get('employeeName') as string | null)?.trim() ?? ''
  const employeeEmail = (formData.get('employeeEmail') as string | null)?.trim() ?? ''
  const relationshipType = formData.get('relationshipType') as string | null
  const yearsWorkedTogetherRaw = formData.get('yearsWorkedTogether') as string | null
  const isLayoffContext = formData.get('isLayoffContext') === 'yes'

  const registrationError = validateEmployerRegistration({
    submitterName,
    submitterTitle,
    submitterCompany,
    submitterEmail,
    employeeName,
    employeeEmail,
  })
  if (registrationError) return { error: registrationError }

  if (!relationshipType) return { error: 'Please choose your relationship to them.' }

  const parsed = parseReferenceFormData(formData)
  if ('error' in parsed) return { error: parsed.error }
  const content = parsed.data

  const yearsWorkedTogether =
    yearsWorkedTogetherRaw && !Number.isNaN(Number(yearsWorkedTogetherRaw)) ? Number(yearsWorkedTogetherRaw) : null

  const submission = await prisma.employerReferenceSubmission.create({
    data: {
      submitterName,
      submitterTitle,
      submitterCompany,
      submitterEmail,
      employeeName,
      employeeEmail,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relationshipType: relationshipType as any,
      yearsWorkedTogether,
      overallRating: content.overallRating,
      wouldHireAgain: content.wouldHireAgain,
      strengthSummary: content.strengthSummary,
      growthAreaSummary: content.growthAreaSummary,
      contextNotes: content.contextNotes,
      ...content.bars,
      ...content.traits,
      superpowerText: content.superpowerText,
      underPressureStory: content.underPressureStory,
      definingStory: content.definingStory,
      wouldWorkWithAgainReason: content.wouldWorkWithAgainReason,
      quotableWithAttribution: content.quotableWithAttribution,
      isLayoffContext,
      invitedAt: new Date(),
    },
  })

  // Must never block the employer's submission from succeeding.
  await sendInviteEmail({
    managerName: submitterName,
    managerCompany: submitterCompany,
    employeeName,
    employeeEmail,
    inviteToken: submission.inviteToken,
  })

  // Section 5 — a single "yes" produces BOTH the immediate founder
  // notification AND the Attio outplacement-pipeline marker, not one or
  // the other. No live Attio API integration exists in this app (no
  // client, no credentials) — attioSyncRequestedAt marks the intent so a
  // real sync can run once that's wired up; see the schema comment.
  if (isLayoffContext) {
    const alertResult = await sendLayoffContextAlertEmail({
      submitterName,
      submitterCompany,
      submitterEmail,
      employeeName,
      employeeEmail,
    })
    await prisma.employerReferenceSubmission.update({
      where: { id: submission.id },
      data: {
        founderNotifiedAt: alertResult.sent ? new Date() : null,
        attioSyncRequestedAt: new Date(),
      },
    })
  }

  redirect('/for-managers/give-a-reference/thank-you')
}
