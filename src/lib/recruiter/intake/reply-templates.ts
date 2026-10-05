// Reply wording for NextChapter Talent (spec F4). Never judges the person:
// it refers to the firm's current searches, not the candidate's quality.
// Pure.

export const REPLY_PLACEHOLDERS = ['{first_name}', '{recruiter_name}', '{firm_name}'] as const

export const DEFAULT_NICHE_REPLY = `Hi {first_name},

Thank you for sending your resume. Your background is in an area we cover, and I'll keep you in mind as new searches open.

I don't have a role for you right now, so in the meantime I've set you up with free support from NextChapter: a read on your market and a plan for your search.

Best,
{recruiter_name}
{firm_name}`

export const DEFAULT_OUTSIDE_REPLY = `Hi {first_name},

Thank you for sending your resume. It isn't a match for our current searches, and I didn't want to leave you without an answer.

I've set you up with free support from NextChapter so you have a next step: a read on your market and a plan for your search.

Best of luck,
{recruiter_name}
{firm_name}`

export function defaultSubject(kind: 'NICHE' | 'OUTSIDE', firmName: string): string {
  return kind === 'NICHE' ? `Your resume with ${firmName}` : `Thank you for reaching out to ${firmName}`
}

export function renderReplyTemplate(
  template: string,
  values: { firstName: string; recruiterName: string; firmName: string }
): string {
  return template
    .replaceAll('{first_name}', values.firstName || 'there')
    .replaceAll('{recruiter_name}', values.recruiterName)
    .replaceAll('{firm_name}', values.firmName)
}

// Recruiter override wins only when the firm lets recruiters edit wording.
export function pickReplyTemplate(
  kind: 'NICHE' | 'OUTSIDE',
  firm: { intakeNicheReplyTemplate: string | null; intakeOutsideReplyTemplate: string | null; intakeRecruitersCanEditTemplates: boolean },
  recruiter: { intakeNicheReplyTemplate: string | null; intakeOutsideReplyTemplate: string | null } | null
): string {
  const own = kind === 'NICHE' ? recruiter?.intakeNicheReplyTemplate : recruiter?.intakeOutsideReplyTemplate
  if (firm.intakeRecruitersCanEditTemplates && own?.trim()) return own
  const firmDefault = kind === 'NICHE' ? firm.intakeNicheReplyTemplate : firm.intakeOutsideReplyTemplate
  if (firmDefault?.trim()) return firmDefault
  return kind === 'NICHE' ? DEFAULT_NICHE_REPLY : DEFAULT_OUTSIDE_REPLY
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
