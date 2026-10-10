import type { FirmSegment } from './match'

/**
 * Draft pitch emails to search firms — DRAFTS for Justin to approve. Nothing
 * here is ever sent automatically; the admin page only shows them to copy.
 * Placeholders: {firstName}, {firmName}, {searchExample}, {link}.
 * Keep each body under 150 words (pitches.test.ts checks).
 */
export interface PitchDraft {
  segment: FirmSegment
  subject: string
  body: string
}

export const SUBMIT_SEARCH_PATH = '/submit-search'

export const PITCH_DRAFTS: PitchDraft[] = [
  {
    segment: 'retained',
    subject: 'Candidates for {firmName} searches, screened and free',
    body: `Hi {firstName},

I run NextChapter, a career platform for senior professionals who were laid off: VPs, directors, and finance, operations and technology leaders. They are available now and actively interviewing.

Send us an open or confidential search, such as {searchExample}. Within days we return a screened shortlist of members at the right level. Our AI reads every profile against your spec, and a person on our team reviews each name before it reaches you. Confidential searches stay confidential: members never see the client.

There is no fee and no contract.

You can submit a search in two minutes here: {link}

Worth a try on one search?

Justin Kulla
Founder, NextChapter`,
  },
  {
    segment: 'contingent',
    subject: 'Free shortlists for your open roles',
    body: `Hi {firstName},

NextChapter is a career platform for mid-level and senior professionals who were laid off. They are available now and they want to interview.

If {firmName} has open roles, such as {searchExample}, send them to us. Within days we send back a screened shortlist of members who fit the level, function and location. AI does the first pass on every profile; a person checks every name before you see it.

It is free. No fee split, no contract, no exclusivity. You keep the candidate relationship and the placement.

Submit a role here, confidential or not: {link}

Want to test it on your hardest open role this week?

Justin Kulla
Founder, NextChapter`,
  },
  {
    segment: 'nonprofit_higher_ed',
    subject: 'Leaders for {firmName} searches, screened and free',
    body: `Hi {firstName},

NextChapter is a career platform for experienced professionals who were laid off. Our members include finance, operations, HR, technology and advancement leaders, and many want mission-driven work at a nonprofit, college or university.

Send us an open or confidential search, such as {searchExample}. Within days we return a screened shortlist of members at the right level. AI reads each profile against your position description, and a person on our team reviews every name. When a search is confidential, members never see the institution.

There is no cost to {firmName} or your client.

Submit a search here: {link}

Could we try it on one current search?

Justin Kulla
Founder, NextChapter`,
  },
]

export function pitchFor(segment: FirmSegment): PitchDraft {
  return PITCH_DRAFTS.find((p) => p.segment === segment) ?? PITCH_DRAFTS[0]
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Fills the placeholders; anything unknown stays readable ("a current search"). */
export function fillPitch(
  draft: PitchDraft,
  v: { firstName?: string | null; firmName: string; searchExample?: string | null; link: string },
): { subject: string; body: string } {
  const fill = (s: string) =>
    s.replaceAll('{firstName}', v.firstName || 'there')
      .replaceAll('{firmName}', v.firmName)
      .replaceAll('{searchExample}', v.searchExample ? `your ${v.searchExample} search` : 'a current search')
      .replaceAll('{link}', v.link)
  return { subject: fill(draft.subject), body: fill(draft.body) }
}
