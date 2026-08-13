// Regression suite for the Gmail confirmation-email classification pipeline
// (classifyInboundEmail + guessTitleFromConfirmationText). Fixtures in
// fixtures/real-emails.json are real production emails captured via the
// Gmail API (see scripts/_capture_fixtures.ts) — not hand-typed, so they
// reproduce real quirks (\r\n line endings, ATS mail-relay subdomains,
// titles with internal commas) that synthetic fixtures would miss and that
// have already caused real classification bugs earlier in this codebase's
// history (company-name-from-generic-subdomain, title never read from the
// body). Every expected value below was captured from this pipeline's own
// output after fixing every bug this suite caught during authoring — see
// the greenhouse-mail.io and Workable-title fixes in the same commit — so
// this is a true regression baseline, not a copy of pre-existing behavior.
import { describe, it, expect } from 'vitest'
import { classifyInboundEmail } from '@/lib/email-tracking/classify-email'
import { guessTitleFromConfirmationText } from '@/lib/email-tracking/ats-patterns'
import fixtures from './fixtures/real-emails.json'

interface Fixture {
  subject: string
  from: string
  bodyPreview: string
  hasListUnsubscribe: boolean
}

interface Expected {
  activityType: string
  companyName: string | null
  title: string | null
}

// LinkedIn's dominant "your application was sent to <Company>" template
// never states the title in the subject — only the body, immediately after
// the "Your application was sent to X" line.
const EXPECTED: Record<string, Expected> = {
  beyGroup: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'Bey Group International', title: 'General Partner' },
  bgbxLinkedin: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'BGBx', title: 'EVP, Managing Director' },
  // Greenhouse's own "Thank You for Applying" template sends from a
  // us.greenhouse-mail.io relay subdomain — without greenhouse-mail.io in
  // ATS_AND_JOB_BOARD_DOMAINS, the domain-guesser took "us" (the subdomain
  // label) as the company name instead of falling through to the body/
  // subject text, which correctly says "BGBx". Greenhouse's confirmation
  // body genuinely never states the title anywhere, so title stays null.
  bgbxGreenhouse: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'BGBx', title: null },
  evidenceActionLinkedin: {
    activityType: 'APPLICATION_CONFIRMATION',
    companyName: 'Evidence Action',
    title: 'Vice President, The AI Access Initiative',
  },
  // Workable's confirmation body states the title as "Your application for
  // the X job was submitted successfully" — a shape with no prior pattern,
  // so this used to return title: null despite the title being right there.
  evidenceActionWorkable: {
    activityType: 'APPLICATION_CONFIRMATION',
    companyName: 'Evidence Action',
    title: 'Vice President, The AI Access Initiative',
  },
  bigWaveDigital: {
    activityType: 'APPLICATION_CONFIRMATION',
    companyName: 'Big Wave Digital',
    title: 'FORWARD DEPLOYED STRATEGIST AI - $230k + equity',
  },
  // Indeed's own "Indeed Application: <title>" subject shape.
  bioUrjaIndeed: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'BioUrja Advisors', title: 'Director, Corporate Development' },
  codaSearch: {
    activityType: 'APPLICATION_CONFIRMATION',
    companyName: 'Coda Search│Staffing',
    title: 'Executive Director - Commercial Real Estate Acquisitions',
  },
  hanover: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'Hanover', title: 'Head of Corporate Development' },
  carterPierce: { activityType: 'APPLICATION_CONFIRMATION', companyName: 'CarterPierce, INC.', title: 'Head of Corporate Development' },
  // A real bulk job-alert-digest newsletter ("138 Social Impact Jobs are
  // Live...") — the true-negative case. Must NEVER classify as an
  // APPLICATION_CONFIRMATION just because it mentions jobs/applying; this is
  // exactly the shape of bug isLikelyBulkOrPromotional exists to catch.
  onPurposeCareersNewsletter: { activityType: 'NEEDS_REVIEW', companyName: null, title: null },
}

describe('Gmail classifier regression suite (real production fixtures)', () => {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    it(`classifies "${key}" correctly`, () => {
      const fixture = (fixtures as Record<string, Fixture>)[key]
      expect(fixture, `missing fixture for ${key}`).toBeDefined()

      const result = classifyInboundEmail(fixture.subject, fixture.bodyPreview, fixture.from, fixture.hasListUnsubscribe)
      expect(result.activityType).toBe(expected.activityType)

      if (expected.activityType === 'APPLICATION_CONFIRMATION') {
        expect(result.companyName).toBe(expected.companyName)
        expect(guessTitleFromConfirmationText(fixture.subject, fixture.bodyPreview)).toBe(expected.title)
      }
    })
  }

  it('never misses a fixture the EXPECTED table forgot to cover', () => {
    const fixtureKeys = Object.keys(fixtures as Record<string, Fixture>)
    const expectedKeys = Object.keys(EXPECTED)
    expect(fixtureKeys.sort()).toEqual(expectedKeys.sort())
  })
})
