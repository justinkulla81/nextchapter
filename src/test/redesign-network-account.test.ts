import { describe, expect, it } from 'vitest'
import { MAX_BUTTON_CHOICES, controlFor } from '@/lib/redesign/choice'
import { sentenceCase } from '@/lib/redesign/text'
import {
  COACH_FEEDBACK_CHOICES,
  COACH_GENDER_CHOICES,
  CONTACT_SCOPES,
  CONTACT_SORT_CHOICES,
  DEFAULT_CONTACT_LIST,
  activeContactFilters,
  coachReasons,
  communityAccessLine,
  contactFact,
  contactWhy,
  contactsHref,
  conversationState,
  documentVerdict,
  googleConnectionLine,
  listingFacts,
  moderationNote,
  outreachHistory,
  postFact,
  postKind,
  ratingText,
  relationLabel,
  shortDate,
  threadFact,
} from '@/lib/redesign/network-account'

describe('choice control (design principle: 2 to 4 buttons, 5 or more a dropdown)', () => {
  it('uses buttons up to four options and a dropdown from five', () => {
    expect(MAX_BUTTON_CHOICES).toBe(4)
    for (const n of [2, 3, 4]) expect(controlFor(n)).toBe('buttons')
    for (const n of [5, 6, 8, 20]) expect(controlFor(n)).toBe('dropdown')
  })

  it('keeps the coaching-match choices as buttons', () => {
    expect(controlFor(COACH_GENDER_CHOICES.length)).toBe('buttons')
    expect(controlFor(COACH_FEEDBACK_CHOICES.length)).toBe('buttons')
  })

  it('keeps the contact sort as buttons', () => {
    expect(controlFor(CONTACT_SORT_CHOICES.length)).toBe('buttons')
  })
})

describe('sentenceCase', () => {
  it('lowercases every word after the first', () => {
    expect(sentenceCase('Your Target Role & Company')).toBe('Your target role & company')
    expect(sentenceCase('Negotiation, Interview & Compensation Readiness')).toBe('Negotiation, interview & compensation readiness')
    expect(sentenceCase('What You Want From Your Career')).toBe('What you want from your career')
  })

  it('keeps acronyms and words with digits', () => {
    expect(sentenceCase('Your AI Skills Plan')).toBe('Your AI skills plan')
    expect(sentenceCase('The Top 10 Roles')).toBe('The top 10 roles')
    expect(sentenceCase('A')).toBe('A')
  })
})

describe('contact list address', () => {
  it('leaves every default out', () => {
    expect(contactsHref(DEFAULT_CONTACT_LIST)).toBe('/dashboard/network/contacts')
  })

  it('writes only what differs, and starts back at page one when asked', () => {
    const state = { ...DEFAULT_CONTACT_LIST, page: 3, q: 'ana' }
    expect(contactsHref(state)).toBe('/dashboard/network/contacts?q=ana&page=3')
    expect(contactsHref(state, { page: 1, sort: 'company', dir: 'desc', pin: false, email: 'has', reached: 'no', rel: 'yes', nc: 'yes' })).toBe(
      '/dashboard/network/contacts?q=ana&sort=company&dir=desc&pin=0&email=has&reached=no&rel=yes&nc=yes'
    )
  })

  it('counts the filters that narrow the list, not the sort or the search', () => {
    expect(activeContactFilters(DEFAULT_CONTACT_LIST)).toBe(0)
    expect(activeContactFilters({ ...DEFAULT_CONTACT_LIST, q: 'x', sort: 'company', email: 'has', nc: 'yes' })).toBe(2)
  })

  it('names three lists, each with its own address', () => {
    expect(CONTACT_SCOPES.map((s) => s.key)).toEqual(['mine', 'nextchapter', 'all'])
    expect(new Set(CONTACT_SCOPES.map((s) => s.href)).size).toBe(3)
  })
})

describe('contact rows', () => {
  const base = { hasReachedOut: false, lastOutreachChannel: null, lastOutreachAt: null, connectedAt: null, isAtCurrentEmployer: false }

  it('formats dates the same everywhere', () => {
    expect(shortDate(new Date('2026-03-04T12:00:00Z'))).toBe('Mar 4, 2026')
  })

  it('says when you last wrote, or that you have not', () => {
    expect(contactFact({ ...base, hasReachedOut: true, lastOutreachChannel: 'EMAIL', lastOutreachAt: new Date('2026-03-04T12:00:00Z') })).toBe('You reached out by email on Mar 4, 2026.')
    expect(contactFact({ ...base, connectedAt: new Date('2021-06-01T12:00:00Z') })).toBe('Not contacted yet. Connected Jun 1, 2021.')
    expect(contactFact(base)).toBe('Not contacted yet.')
  })

  it('turns the "Your employer" tag into a sentence', () => {
    expect(contactFact({ ...base, isAtCurrentEmployer: true })).toBe('Not contacted yet. Works at your current employer, so write with care.')
  })

  it('summarizes outreach history', () => {
    expect(outreachHistory({ outreachCount: 0, lastOutreachChannel: null, lastOutreachAt: null })).toBe('You have not reached out yet.')
    expect(outreachHistory({ outreachCount: 1, lastOutreachChannel: 'LINKEDIN', lastOutreachAt: new Date('2026-03-04T12:00:00Z') })).toBe('You have reached out 1 time, most recently by LinkedIn message on Mar 4, 2026.')
    expect(outreachHistory({ outreachCount: 3, lastOutreachChannel: null, lastOutreachAt: null })).toBe('You have reached out 3 times.')
  })

  it('says who they are without a membership tag', () => {
    expect(contactWhy({ title: 'CFO', company: 'Acme', membershipLabel: 'Coach', relationshipLabels: ['Former colleague'] })).toBe('CFO at Acme · Coach on NextChapter · Former colleague')
    expect(contactWhy({ title: null, company: null, inferredCompany: 'Globex' })).toBe('Globex')
    expect(contactWhy({ title: null, company: null })).toBeUndefined()
    expect(contactWhy({ title: 'Partner', company: 'Lee Search', membershipLabel: 'Recruiter', relationshipLabels: ['Recruiter', 'Friend'] })).toBe('Partner at Lee Search · Recruiter on NextChapter · Friend')
  })
})

describe('community words', () => {
  it('puts the unread count in the label', () => {
    expect(relationLabel('Coaches', 0)).toBe('Coaches')
    expect(relationLabel('Coaches', 2)).toBe('Coaches (2 new)')
  })

  it('says a thread has a new reply in words', () => {
    expect(threadFact(true, 'Coach')).toBe('New reply waiting')
    expect(threadFact(false, 'Coach')).toBe('Coach')
    expect(threadFact(false, null)).toBeUndefined()
  })

  it('writes the post kind in sentence case and skips plain updates', () => {
    expect(postKind('Project / consulting opportunity', false)).toBe('Project / consulting opportunity')
    expect(postKind('JOB OPENING', false)).toBe('Job opening')
    expect(postKind('Update', true)).toBeNull()
    expect(postKind(undefined, false)).toBeNull()
  })

  it('only tells the author about moderation', () => {
    expect(moderationNote('HELD', false)).toBeNull()
    expect(moderationNote('HELD', true)).toContain('reviewing')
    expect(moderationNote('REMOVED', true)).toContain('removed')
    expect(moderationNote('PUBLISHED', true)).toBeNull()
    expect(moderationNote('PENDING', true)).toBeNull()
  })

  it('joins where a post is about', () => {
    expect(postFact(['Boston', null, 'Fintech'])).toBe('Boston · Fintech')
    expect(postFact([null, undefined])).toBeUndefined()
  })
})

describe('coach matching', () => {
  it('has a "no preference" first choice with an empty value, so skipping saves nothing', () => {
    expect(COACH_GENDER_CHOICES[0]).toEqual({ value: '', label: 'No preference' })
    expect(COACH_FEEDBACK_CHOICES[0]).toEqual({ value: '', label: 'No preference' })
  })

  it('leads with the best reason and keeps the rest for on demand', () => {
    expect(coachReasons(['Works with CFOs', 'Fintech', 'Boston'])).toEqual({ lead: 'Works with CFOs', rest: ['Fintech', 'Boston'] })
    expect(coachReasons([])).toEqual({ lead: null, rest: [] })
  })
})

describe('privacy and account', () => {
  it('describes the Google connection in a sentence, with whether to act', () => {
    expect(googleConnectionLine('connected', 'connected')).toMatchObject({ needsAction: false })
    expect(googleConnectionLine('expired', 'connected')).toMatchObject({ needsAction: true })
    expect(googleConnectionLine('not_connected', 'not_connected').text).toContain('Not connected')
    expect(googleConnectionLine('connected', 'not_connected').text).toContain('Calendar is not connected')
    expect(googleConnectionLine('not_connected', 'connected').text).toContain('Gmail is not connected')
  })

  it('says which privacy tiers can post in the community', () => {
    expect(communityAccessLine('PUBLIC').canPost).toBe(true)
    expect(communityAccessLine('SEMI_PUBLIC').canPost).toBe(true)
    for (const t of ['PRIVATE', 'STEALTH', 'LOCKED']) expect(communityAccessLine(t).canPost).toBe(false)
  })

  it('says what a document request needs, as a verdict and a reason', () => {
    expect(documentVerdict('REQUESTED', null, false).verdict).toBe('This needs your file.')
    expect(documentVerdict('REQUESTED', null, true).verdict).toBe('This is overdue.')
    expect(documentVerdict('NEEDS_CHANGES', 'Sign page 2', false).why).toBe('What needs to change: Sign page 2')
    expect(documentVerdict('NEEDS_CHANGES', null, false).why).toBe('The reviewer asked for a change.')
    expect(documentVerdict('UPLOADED', null, false).verdict).toBe('Uploaded.')
    expect(documentVerdict('ACCEPTED', null, false).verdict).toBe('Accepted.')
    expect(documentVerdict('CANCELLED', null, false).verdict).toBe('Cancelled.')
  })

  it('names the state of a help conversation', () => {
    expect(conversationState(true, false)).toBe('Reply waiting')
    expect(conversationState(false, true)).toBe('Resolved')
    expect(conversationState(false, false)).toBe('We are on it')
  })
})

describe('benefits network', () => {
  const listing = { function: 'Finance', level: 'Director', format: 'Self-paced', costType: 'Free', timeCommitment: 'Under 5 hours', credentialType: 'Certificate' }

  it('turns six tags into one line of facts', () => {
    expect(listingFacts(listing)).toBe('Finance · Director · Self-paced · Free · Under 5 hours · Certificate')
    expect(listingFacts({ ...listing, seatCount: 1 })).toBe('Finance · Director · Self-paced · Free · Under 5 hours · Certificate · 1 seat')
    expect(listingFacts({ ...listing, seatCount: 12 })).toContain('12 seats')
  })

  it('states a rating plainly or not at all', () => {
    expect(ratingText(null, 0)).toBeNull()
    expect(ratingText(4.25, 1)).toBe('4.3 out of 5 from 1 rating')
    expect(ratingText(4, 8)).toBe('4.0 out of 5 from 8 ratings')
  })
})
