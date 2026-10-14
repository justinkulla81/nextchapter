import { describe, it, expect } from 'vitest'
import { assessRecruiterEmail, findClaimedCompany, rootDomain, extractUrlsFromText } from '@/lib/scam-shield/assess-recruiter-email'

describe('assessRecruiterEmail', () => {
  it('flags the fake Optavise CIO-interview recruiter email', () => {
    const r = assessRecruiterEmail({
      from: 'Jordan Reyes <talent@ourrecruitingteam.org>',
      subject: 'Optavise CIO interview — please book your call',
      body:
        'Hello, I am a recruiter for Optavise. We reviewed your resume for the Optavise CIO interview and need your attention ' +
        'before you book. This is time-sensitive. Book here: https://usweb04.org/book/abc123',
      linkUrls: ['https://usweb04.org/book/abc123'],
    })
    expect(r.level).toBe('likely_fake')
    expect(r.claimedCompany).toBe('Optavise')
    expect(r.flaggedDomains).toEqual(expect.arrayContaining(['ourrecruitingteam.org', 'usweb04.org']))
    expect(r.signals.map((s) => s.code)).toEqual(expect.arrayContaining(['sender_domain_mismatch', 'link_domain_mismatch']))
  })

  it('leaves a real recruiter on the company domain alone', () => {
    const r = assessRecruiterEmail({
      from: 'Sam Lee <sam.lee@optavise.com>',
      subject: 'Interview with Optavise',
      body: 'Hi, I am a recruiter at Optavise. Pick a time here: https://calendly.com/sam-optavise/30min',
      linkUrls: ['https://calendly.com/sam-optavise/30min'],
    })
    expect(r.level).toBe('none')
  })

  it('does not alert on a personal address alone', () => {
    const r = assessRecruiterEmail({
      from: 'Pat <pat.recruits@gmail.com>',
      subject: 'Role at Northwind',
      body: 'I am a recruiter for Northwind and your background looks interesting for a position we have.',
      linkUrls: [],
    })
    expect(r.level).toBe('none')
  })

  it('does not alert on a staffing firm writing for a client', () => {
    const r = assessRecruiterEmail({
      from: 'Ana <ana@brightstaffing.com>',
      subject: 'Opportunity at Contoso',
      body: 'I am recruiting on behalf of Contoso for a Director role. Details: https://brightstaffing.com/jobs/42',
      linkUrls: ['https://brightstaffing.com/jobs/42'],
    })
    expect(r.level).toBe('none')
  })

  it('flags a lookalike domain and a request for ID', () => {
    const r = assessRecruiterEmail({
      from: 'HR <hr@optavise-careers.com>',
      subject: 'Position at Optavise',
      body: 'We are hiring. Please send a photo of your ID and your social security number to finish onboarding.',
      linkUrls: [],
    })
    expect(r.level).toBe('likely_fake')
    expect(r.signals.map((s) => s.code)).toEqual(expect.arrayContaining(['lookalike_domain', 'sensitive_info_request']))
  })

  it('flags a failed sender check plus a money request', () => {
    const r = assessRecruiterEmail({
      from: 'Careers <jobs@workfromhome-hiring.xyz>',
      subject: 'You have been selected for a remote job',
      body: 'Your position starts immediately. We will send you a check to purchase equipment. Message us on Telegram.',
      linkUrls: [],
      authResults: 'mx.google.com; spf=fail smtp.mailfrom=workfromhome-hiring.xyz; dmarc=fail',
    })
    expect(r.level).toBe('likely_fake')
  })

  it('ignores mail with no job context', () => {
    const r = assessRecruiterEmail({
      from: 'Billing <billing@random-shop.xyz>',
      subject: 'Your receipt',
      body: 'Thanks for your order. https://random-shop.xyz/r/1',
      linkUrls: ['https://random-shop.xyz/r/1'],
    })
    expect(r.level).toBe('none')
  })
})

describe('helpers', () => {
  it('finds the company a recruiter claims', () => {
    expect(findClaimedCompany('x@y.com', 'Interview with Optavise', '')).toBe('Optavise')
    expect(findClaimedCompany('x@y.com', 'Hello', 'Optavise is hiring a CIO')).toBe('Optavise')
  })
  it('reduces hosts to registrable domains', () => {
    expect(rootDomain('book.usweb04.org')).toBe('usweb04.org')
    expect(rootDomain('careers.example.co.uk')).toBe('example.co.uk')
  })
  it('pulls bare URLs from text', () => {
    expect(extractUrlsFromText('see https://a.com/x, and http://b.org/y)')).toEqual(['https://a.com/x', 'http://b.org/y'])
  })
})
