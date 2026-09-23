// Rejection detection against real rejection emails that were missed in
// production (trimmed to their body text, personal details removed), plus
// the confirmation/interview mail that must NOT read as a rejection even
// though it shares vocabulary ("careful consideration", "moving forward").
import { describe, it, expect } from 'vitest'
import { classifyInboundEmail } from '@/lib/email-tracking/classify-email'
import { matchRejection, normalizeForMatching } from '@/lib/email-tracking/ats-patterns'

const REJECTIONS: [string, string, string][] = [
  [
    'CUNY / Baruch — "no longer under active consideration"',
    'Baruch College: 30861 - Assistant Professor in Business, Society and Sustainability',
    'Dear Candidate: Thank you for your interest in employment at The City University of New York. We have reviewed applications for the following position to which you applied: Job ID 30861. As a result of this review, we are writing to inform you that you are no longer under active consideration for this position. We appreciate the time you took to apply.',
  ],
  [
    'Pearl via Greenhouse — "decided not to proceed with your candidacy"',
    'Thank you for considering a career at Pearl',
    'Dear Justin, Thank you for your interest in Pearl. Unfortunately, at this time the team has decided not to proceed with your candidacy for the VP, Corporate Development position. Please keep an eye on our Careers page.',
  ],
  [
    'CloudLinux via Workable — hard-wrapped plain text',
    'Director of Corporate Development (remote work) - Cloudlinux',
    'Dear Justin,\n\nThank you for taking the time to apply for a position at CloudLinux.\n\nWe have received a high volume of applications, and after careful\nconsideration, we regret to inform you that we will not be moving forward with\nyour application at this time.',
  ],
  [
    'Hyland via iCIMS — curly apostrophe',
    'Update on Your Application with Hyland',
    'Thank you for your interest in Hyland. After careful consideration, we’ve decided to move forward with other candidates at this time.',
  ],
  [
    'HTML entity apostrophe',
    'Your application',
    'After careful review, we&rsquo;ve decided not to move forward with your application.',
  ],
  ['position filled', 'Update', 'Thank you for applying. The position you applied for has been filled.'],
  ['pursue other candidates', 'Your application', 'We appreciate your interest; however, we have decided to pursue other candidates for this role.'],
  ['not the right fit', 'Re: application', 'Thanks for applying. Unfortunately you are not the right fit for this role at this time.'],
  ['selected another candidate', 'Update on the VP role', 'We have selected another candidate whose experience more closely matches your application for this position.'],
]

const NOT_REJECTIONS: [string, string, string, string][] = [
  [
    'Morgan Stanley confirmation — "careful consideration" is future tense',
    'Thank You for Your Application!',
    'Thank you for your interest in the Executive Director position. We will give careful consideration to your application by reviewing the details you provided against the position criteria.',
    'APPLICATION_CONFIRMATION',
  ],
  [
    'Empire State Development auto-reply — conditional "moving forward"',
    'Automatic reply: Director, Entrepreneur Development',
    'Thank you for your interest in career opportunities with Empire State Development. If we are interested in moving forward with your candidacy, one of our representatives will contact you directly. Due to the high volume of resumes we receive, we are only able to contact candidates selected for follow up.',
    'APPLICATION_CONFIRMATION',
  ],
  [
    'CloudLinux confirmation',
    'Director of Corporate Development (remote work) - Cloudlinux',
    'Thank you for your interest in the Director of Corporate Development position at Cloudlinux! Our team is currently reviewing all applications to find the best matches for the role. We will contact you as soon as we complete reviewing your application.',
    'APPLICATION_CONFIRMATION',
  ],
  [
    'interview invite that opens with "after careful review"',
    'Next steps',
    'After careful review of your application, we would like to invite you to interview for the role.',
    'INTERVIEW_INVITE',
  ],
  [
    'conditional confirmation',
    'Thanks for applying',
    'If we are not moving forward with your application, we will let you know by email.',
    'APPLICATION_CONFIRMATION',
  ],
]

describe('rejection detection', () => {
  for (const [name, subject, body] of REJECTIONS) {
    it(`catches: ${name}`, () => {
      const r = classifyInboundEmail(subject, body, 'no-reply@ats-relay.example', false)
      expect(r.activityType).toBe('REJECTION')
      expect(r.confidence).toBe('high')
    })
  }

  for (const [name, subject, body, expected] of NOT_REJECTIONS) {
    it(`does not flag: ${name}`, () => {
      expect(matchRejection(subject, body).matched && matchRejection(subject, body).confidence === 'high').toBe(false)
      expect(classifyInboundEmail(subject, body, 'jobs@company.example', false).activityType).toBe(expected)
    })
  }

  it('a loyalty program ending a perk is not a rejection', () => {
    const r = classifyInboundEmail(
      'Update to select AAdvantage® benefits',
      'Today we wanted to let you know after careful consideration, we have mutually decided to not continue our enhanced relationship in the coming months. We are excited to continue building on the program with more opportunities to earn.',
      'AmericanAirlines@info.ms.aa.com', true,
    )
    expect(r.activityType).not.toBe('REJECTION')
  })

  it('a newsletter about hiring is not a rejection', () => {
    const r = classifyInboundEmail('Weekly digest', 'Why so many companies are not moving forward with hiring plans this quarter.', 'news@digest.example', true)
    expect(r.activityType).not.toBe('REJECTION')
  })
})

describe('normalizeForMatching', () => {
  it('collapses line breaks, non-breaking spaces and entities', () => {
    expect(normalizeForMatching('after careful\r\nconsideration,&nbsp;we&#8217;ve decided')).toBe("after careful consideration, we've decided")
  })
})
