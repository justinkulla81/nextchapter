import { signLink, verifyLink } from '@/lib/email/signed-links'

const PURPOSE = 'claim-profile'

/** The link a CRM person is sent to claim a NextChapter profile. The signature binds it to that person. */
export function claimUrl(appUrl: string, personId: string): string {
  return `${appUrl}/claim/${personId}?sig=${signLink(PURPOSE, personId)}`
}

export function verifyClaim(personId: string, sig: string | null | undefined): boolean {
  return verifyLink(sig, PURPOSE, personId)
}

export function firstNameOf(fullName: string, firstName: string | null): string {
  return (firstName?.trim() || fullName.trim().split(/\s+/)[0] || 'there')
}

export interface ClaimDrafts {
  subject: string
  emailBody: string
  linkedinText: string
}

/**
 * The messages that go with a claim link. One-to-one, plain, and they lead with
 * what the person gets. The email carries the same opt-out line as cold outreach.
 */
export function claimDrafts(input: { firstName: string; orgName: string | null; url: string }): ClaimDrafts {
  const { firstName, orgName, url } = input
  const basis = orgName ? `your work at ${orgName} and the market around it` : 'public information and the market around your field'
  return {
    subject: 'Your NextChapter profile',
    emailBody: [
      `${firstName},`,
      '',
      `I built a private NextChapter profile for you from ${basis}. It takes about 30 seconds to claim, and no resume is needed.`,
      '',
      url,
      '',
      'If you would rather I did not, reply "no" and I will not write again.',
      '',
      'Justin',
    ].join('\n'),
    linkedinText: `${firstName}, I built a private NextChapter profile for you from ${basis}. About 30 seconds to claim, no resume needed: ${url}`,
  }
}
