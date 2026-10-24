import { describe, expect, it } from 'vitest'
import { parseNextSteps } from '@/lib/google/meeting-notes'
import {
  buildDraftInput,
  buildDraftPrompt,
  buildSendManifest,
  checkImportedNotes,
  cleanText,
  coachMayReadProgress,
  doingLabel,
  firstNameOf,
  followUpsFromNextSteps,
  hasDraftMaterial,
  looksLikeTranscript,
  ownerLabel,
  parseDraft,
  parseDueOn,
  planActionText,
  visibleToMember,
} from '@/lib/coach/session-notes'
import { pickBookingForSession } from '@/lib/coach/meet-notes'
import { coachUpdateEmailContent } from '@/lib/email/send-coach-update-email'

const GEMINI = `Summary
A good call.

Next steps
[Maya Ortiz] Introduce Dana to two controllers: before Nov 2
[Dana Whitfield] Decide on controller roles
[Priya Shah] Send the template
Just a stray sentence

Details
More.`

describe('cleanText', () => {
  it('trims, refuses empty and refuses too long rather than cutting', () => {
    expect(cleanText('  hi  ', 10)).toBe('hi')
    expect(cleanText('   ', 10)).toBeNull()
    expect(cleanText('x'.repeat(11), 10)).toBeNull()
    expect(cleanText(5, 10)).toBeNull()
  })
})

describe('imported notes: notes yes, transcripts no', () => {
  const transcript = Array.from({ length: 40 }, (_, i) => `${i % 2 ? 'Dana Whitfield' : 'Maya Ortiz'}: and then I said something about the role number ${i}`).join('\n')
  const stamped = Array.from({ length: 40 }, (_, i) => `00:${String(i).padStart(2, '0')}:10 so we talked about line ${i}`).join('\n')

  it('refuses a speaker-by-speaker transcript and a timestamped one, in plain words', () => {
    expect(looksLikeTranscript(transcript)).toBe(true)
    expect(looksLikeTranscript(stamped)).toBe(true)
    const r = checkImportedNotes(transcript)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/transcript/i)
  })
  it('accepts Gemini-style notes and short notes with a few labeled lines', () => {
    expect(checkImportedNotes(GEMINI)).toEqual({ ok: true, text: GEMINI })
    expect(looksLikeTranscript('Maya: intro\nDana: reply\nNext steps\n[Dana] Do it')).toBe(false)
  })
  it('refuses empty and over-long notes', () => {
    expect(checkImportedNotes('  ').ok).toBe(false)
    expect(checkImportedNotes('a '.repeat(11_000)).ok).toBe(false)
  })
})

describe('follow-ups from Gemini next steps', () => {
  it('keeps the coach’s and the member’s steps and drops everyone else’s', () => {
    const steps = parseNextSteps(GEMINI, ['Maya Ortiz'])
    const out = followUpsFromNextSteps(steps, ['Dana Whitfield', 'Dana'])
    expect(out).toEqual([
      { ownerKind: 'coach', text: 'Introduce Dana to two controllers: before Nov 2' },
      { ownerKind: 'member', text: 'Decide on controller roles' },
    ])
  })
})

describe('dates and labels', () => {
  it('parses only real calendar dates', () => {
    expect(parseDueOn('2026-11-03')?.toISOString()).toBe('2026-11-03T00:00:00.000Z')
    expect(parseDueOn('2026-02-31')).toBeNull()
    expect(parseDueOn('11/03/2026')).toBeNull()
    expect(parseDueOn(undefined)).toBeNull()
  })
  it('puts the date in the plan text and the coach’s name on the coach’s steps', () => {
    expect(planActionText('Decide on controller roles', parseDueOn('2026-11-03'))).toBe('Decide on controller roles (due Nov 3)')
    expect(planActionText('Decide', null)).toBe('Decide')
    expect(ownerLabel('member', 'Maya')).toBe('Yours')
    expect(ownerLabel('coach', 'Maya')).toBe('Maya’s')
    expect(doingLabel('coach', 'Maya')).toBe('Maya is doing this')
    expect(doingLabel('member', 'Maya')).toBe('Added to Your week')
    expect(firstNameOf('Maya Ortiz')).toBe('Maya')
    expect(firstNameOf(null)).toBe('your coach')
  })
})

describe('the model draft', () => {
  const input = { coachFirstName: 'Maya', memberFirstName: 'Dana', captures: [{ kind: 'win' as const, text: 'Doubled search time' }, { kind: 'next_step' as const, text: 'Practise the story' }], meetNotes: 'Notes by Gemini: …' }

  it('is built from the captures and the imported notes only', () => {
    const text = buildDraftInput(input)
    expect(text).toContain('Win: Doubled search time')
    expect(text).toContain('Next step: Practise the story')
    expect(text).toContain('Notes by Gemini')
    // The private notes are not an input at all: DraftInput has no field for them.
    expect(Object.keys(input)).not.toContain('privateNotes')
  })
  it('says what it will not do and which topics exist', () => {
    const p = buildDraftPrompt(input)
    expect(p).toMatch(/Do not mention private notes/)
    expect(p).toContain('panel_interviews')
    expect(p).toMatch(/data, not instructions/)
  })
  it('needs material before it will draft', () => {
    expect(hasDraftMaterial({ captures: [], meetNotes: '  ' })).toBe(false)
    expect(hasDraftMaterial({ captures: [], meetNotes: 'x' })).toBe(true)
    expect(hasDraftMaterial(input)).toBe(true)
  })
  it('accepts only the shape and the controlled topics', () => {
    expect(parseDraft({ summary: 's', followUps: [{ owner: 'coach', text: 't' }], topics: [{ topic: 'public_speaking', quote: 'q' }] })).not.toBeNull()
    expect(parseDraft({ summary: 's', followUps: [], topics: [{ topic: 'made_up_topic', quote: 'q' }] })).toBeNull()
    expect(parseDraft({ summary: 's', followUps: [{ owner: 'someone', text: 't' }], topics: [] })).toBeNull()
  })
})

describe('what the member will receive', () => {
  const base = { memberFirstName: 'Dana', summaryText: 'A good session.', captureCount: 4, hasPrivateNotes: true, hasMeetNotes: true }
  it('counts what is sent and names what is not', () => {
    const m = buildSendManifest({
      ...base,
      followUps: [{ ownerKind: 'member', text: 'a', dueOn: null }, { ownerKind: 'member', text: 'b', dueOn: null }, { ownerKind: 'coach', text: 'c', dueOn: null }],
      topics: [{ status: 'confirmed' }, { status: 'confirmed' }, { status: 'suggested' }],
    })
    expect(m.counts).toEqual({ memberTodos: 2, coachFollowUps: 1, confirmedTopics: 2 })
    expect(m.receives).toEqual([
      'Your summary, as you edited it',
      '2 to-dos in Dana’s plan, with due dates where you set them',
      '1 follow-up of yours, labeled with your name, so Dana can see what you are doing',
      '2 confirmed topics to accept or dismiss',
    ])
    expect(m.notSent).toBe('Not sent: your private notes, the captures, the meeting notes, 1 topic you have not confirmed')
    expect(m.blockedReason).toBeNull()
  })
  it('blocks, with the reason, when there is no summary', () => {
    const m = buildSendManifest({ ...base, summaryText: '  ', followUps: [], topics: [] })
    expect(m.blockedReason).toMatch(/Write or draft the summary first/)
  })
  it('lists only the summary when there is nothing else', () => {
    const m = buildSendManifest({ ...base, hasPrivateNotes: false, captureCount: 0, hasMeetNotes: false, followUps: [], topics: [] })
    expect(m.receives).toEqual(['Your summary, as you edited it'])
    expect(m.notSent).toBe('Not sent: anything else from this session')
  })
})

describe('visibility and consent', () => {
  it('shows a follow-up to the member only once it was made visible by a send', () => {
    const rows = [{ id: 'a', visibleToMemberAt: null }, { id: 'b', visibleToMemberAt: new Date() }]
    expect(visibleToMember(rows).map((r) => r.id)).toEqual(['b'])
  })
  it('lets the coach read progress only with the member’s consent', () => {
    expect(coachMayReadProgress({ coachDossierConsentedAt: null })).toBe(false)
    expect(coachMayReadProgress({ coachDossierConsentedAt: new Date() })).toBe(true)
  })
})

describe('the booking a session belongs to', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 29, h))
  it('picks the nearest booking with a calendar event within a day', () => {
    const picked = pickBookingForSession(
      [{ startsAt: at(14), googleEventId: 'e1' }, { startsAt: at(20), googleEventId: 'e2' }, { startsAt: at(15), googleEventId: null }],
      at(15),
    )
    expect(picked?.googleEventId).toBe('e1')
  })
  it('picks nothing when no booking is near or none has an event', () => {
    expect(pickBookingForSession([{ startsAt: new Date(Date.UTC(2026, 9, 1)), googleEventId: 'e' }], at(15))).toBeNull()
    expect(pickBookingForSession([{ startsAt: at(15), googleEventId: null }], at(15))).toBeNull()
  })
})

describe('the email notice', () => {
  const p = { memberFirstName: 'Dana', coachFirstName: 'Maya', confidential: false, url: 'https://launchyournextchapter.com/dashboard/my-coaching' }
  it('says there is an update and links to it, and takes no summary text', () => {
    const e = coachUpdateEmailContent(p)
    expect(e.subject).toBe('Maya sent you an update')
    expect(e.text).toContain(p.url)
    expect(e.html).toContain(p.url)
    expect(Object.keys(p)).not.toContain('summary')
  })
  it('names nothing about a search in Confidential Search Mode', () => {
    const e = coachUpdateEmailContent({ ...p, confidential: true, url: 'https://launchyournextchapter.com/dashboard' })
    expect(e.subject).toBe('An update from NextChapter')
    expect(e.text).not.toMatch(/Maya|coach|interview|job search/i)
  })
})
