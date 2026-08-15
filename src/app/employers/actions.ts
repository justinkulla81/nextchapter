'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  isBusinessEmail,
  scoreEmployerWaitlistLead,
  type AnticipatedVolume,
  type EvaluatingWindow,
} from '@/lib/employer/waitlist-scoring'

export type SubmitEmployerWaitlistState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success' }

// Partners Master Build Script §C4.3 — a dedicated server action rather
// than the generic client-only WaitlistForm (src/components/audience/
// WaitlistForm.tsx), because the employer waitlist needs a real, trusted,
// server-computed score at submission time (§C4.3's auto-scoring rule),
// not just a payload passthrough. Still writes to the same generic
// WaitlistSignup table/audience convention ("Employer") the rest of the
// site's waitlists use — no schema change needed, the score is stored
// inside payload alongside the raw answers.
export async function submitEmployerWaitlist(
  _prevState: SubmitEmployerWaitlistState,
  formData: FormData
): Promise<SubmitEmployerWaitlistState> {
  const workEmail = (formData.get('workEmail') as string | null)?.trim() ?? ''
  const fullName = (formData.get('fullName') as string | null)?.trim() ?? ''
  const role = (formData.get('role') as string | null)?.trim() ?? ''
  const company = (formData.get('company') as string | null)?.trim() ?? ''
  const companySize = (formData.get('companySize') as string | null)?.trim() ?? ''
  const evaluatingWindow = (formData.get('evaluatingWindow') as EvaluatingWindow | null) ?? 'exploring'
  const currentProvider = (formData.get('currentProvider') as string | null)?.trim() ?? ''
  const anticipatedVolume = (formData.get('anticipatedVolume') as AnticipatedVolume | null) ?? 'under_10'
  const levelsAffected = (formData.get('levelsAffected') as string | null)?.trim() ?? ''
  const whatMattersMost = (formData.get('whatMattersMost') as string | null)?.trim() ?? ''
  const timeline = (formData.get('timeline') as string | null)?.trim() ?? ''
  const referredBy = (formData.get('referredBy') as string | null)?.trim() || null

  // Honeypot, same convention as WaitlistForm.tsx.
  if ((formData.get('_gotcha') as string | null)?.trim()) {
    return { status: 'success' }
  }

  if (!workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return { status: 'error', error: 'Enter a valid work email.' }
  }
  if (!isBusinessEmail(workEmail)) {
    return { status: 'error', error: 'Please use your work email — this list is for employer evaluators.' }
  }
  if (!fullName || !company) {
    return { status: 'error', error: 'Please fill in your name and company.' }
  }

  const score = scoreEmployerWaitlistLead({ evaluatingWindow, anticipatedVolume, currentProvider })

  const lead = await prisma.waitlistSignup.create({
    data: {
      audience: 'Employer',
      payload: {
        fullName,
        workEmail,
        role,
        company,
        companySize,
        evaluatingWindow,
        currentProvider,
        anticipatedVolume,
        levelsAffected,
        whatMattersMost,
        timeline,
        referredBy,
        flaggedForImmediateOutreach: score.flaggedForImmediateOutreach,
        scoreReason: score.reason,
        // Double opt-in is scaffolded, not wired this phase — see
        // waitlist mechanics note in the marketing build report. This flag
        // is the hook a future confirmation-email flow would flip.
        confirmedAt: null,
      },
    },
  })

  captureServerEvent(lead.id, 'employer_waitlist_submitted', {
    leadId: lead.id,
    company,
    evaluatingWindow,
    anticipatedVolume,
    currentProvider: currentProvider || 'none',
    flaggedForImmediateOutreach: score.flaggedForImmediateOutreach,
    referred: Boolean(referredBy),
  })

  return { status: 'success' }
}
