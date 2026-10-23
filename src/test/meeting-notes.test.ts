import { describe, it, expect } from 'vitest'
import { meetUrlOf, geminiNotesDocOf, docToText, capNotes, parseNextSteps, NOTES_BODY_LIMIT } from '@/lib/google/meeting-notes'

describe('meetUrlOf', () => {
  it('prefers hangoutLink', () => {
    expect(meetUrlOf({ hangoutLink: 'https://meet.google.com/abc-defg-hij' })).toBe('https://meet.google.com/abc-defg-hij')
  })
  it('falls back to the video entry point, ignoring phone', () => {
    expect(meetUrlOf({ conferenceData: { entryPoints: [
      { entryPointType: 'phone', uri: 'tel:+1555' },
      { entryPointType: 'video', uri: 'https://meet.google.com/x' },
    ] } })).toBe('https://meet.google.com/x')
  })
  it('is null when there is no conference', () => {
    expect(meetUrlOf({})).toBeNull()
  })
})

describe('geminiNotesDocOf', () => {
  const doc = (title: string, mimeType = 'application/vnd.google-apps.document') =>
    ({ fileId: 'f1', fileUrl: 'https://docs.google.com/document/d/f1', title, mimeType })
  it('finds the Gemini notes doc', () => {
    expect(geminiNotesDocOf([doc('Intro call - 2026/10/09 - Notes by Gemini')])?.fileId).toBe('f1')
  })
  it('ignores the transcript and unrelated docs', () => {
    expect(geminiNotesDocOf([doc('Intro call - Transcript'), doc('Agenda')])).toBeNull()
  })
  it('ignores a non-doc attachment with a matching title', () => {
    expect(geminiNotesDocOf([doc('Notes by Gemini', 'application/pdf')])).toBeNull()
  })
  it('handles no attachments', () => {
    expect(geminiNotesDocOf(undefined)).toBeNull()
  })
  it('reads a real event attachment that has only a link and a title', () => {
    expect(geminiNotesDocOf([{ fileUrl: 'https://docs.google.com/document/d/1AbC-d_E9/edit?usp=meet_tnfm_calendar', title: 'Notes by Gemini' }]))
      .toEqual({ fileId: '1AbC-d_E9', url: 'https://docs.google.com/document/d/1AbC-d_E9/edit?usp=meet_tnfm_calendar', title: 'Notes by Gemini' })
  })
  it('skips a link-only attachment whose link is not a Google Doc', () => {
    expect(geminiNotesDocOf([{ fileUrl: 'https://example.com/x', title: 'Notes by Gemini' }])).toBeNull()
  })
})

describe('docToText', () => {
  const para = (t: string) => ({ paragraph: { elements: [{ textRun: { content: t } }] } })
  it('reads a plain body', () => {
    expect(docToText({ body: { content: [para('Summary\n'), para('\n'), para('Next steps\n')] } })).toBe('Summary\nNext steps')
  })
  it('reads tabs, including child tabs and tables', () => {
    const table = { table: { tableRows: [{ tableCells: [{ content: [para('Owner: Justin\n')] }] }] } }
    expect(docToText({ tabs: [{
      documentTab: { body: { content: [para('Notes\n')] } },
      childTabs: [{ documentTab: { body: { content: [table] } } }],
    }] })).toBe('Notes\nOwner: Justin')
  })
})

describe('capNotes', () => {
  it('truncates past the limit', () => {
    expect(capNotes('x'.repeat(NOTES_BODY_LIMIT + 50)).length).toBe(NOTES_BODY_LIMIT)
  })
  it('leaves short notes alone', () => {
    expect(capNotes('short')).toBe('short')
  })
})

describe('parseNextSteps', () => {
  const notes = [
    'Summary', 'They want a pilot.', 'Decisions', 'Start in January.',
    'Suggested next steps',
    '[Justin Kulla] Send deck: Justin will email the deck by Friday.',
    '[Susan Lee] Intro to HR: Susan will introduce Justin to the CHRO.',
    '[Justin Kulla, Susan Lee] Book follow-up',
    'A stray sentence that is not an item.',
    'Details', '[Justin Kulla] Not a step: this is in Details.',
  ].join('\n')
  const steps = parseNextSteps(notes, ['Justin Kulla'])
  it('reads owner, title and detail, stopping at the next heading', () => {
    expect(steps.map((s) => s.title)).toEqual(['Send deck', 'Intro to HR', 'Book follow-up'])
    expect(steps[0].detail).toBe('Justin will email the deck by Friday.')
    expect(steps[2].detail).toBeNull()
  })
  it('marks only your own items, including shared ones', () => {
    expect(steps.map((s) => s.mine)).toEqual([true, false, true])
  })
  it('matches on first name alone', () => {
    expect(parseNextSteps('Next steps\n[Justin] Call back', ['Justin Kulla'])[0].mine).toBe(true)
  })
  it('returns nothing without a Next steps heading', () => {
    expect(parseNextSteps('Summary\n[Justin Kulla] Something', ['Justin Kulla'])).toEqual([])
  })
})

describe('a real Gemini notes document layout', () => {
  // Shape observed in a real "Notes by Gemini" doc (content invented): a
  // "Quick notes" tab that already lists Next steps, then the full notes,
  // which list them again after Summary and Decisions.
  const para = (s: string) => ({ paragraph: { elements: [{ textRun: { content: `${s}\n` } }] } })
  const quick = ['Quick notes', 'Please rate the new Quick notes tab by taking a short survey.', 'Weekly sync', 'Topic one', 'Next steps',
    '[Alex Kim] Send deck: Email the deck and the latest report.',
    '[Sam Rivera] Intro to Dana: Forward the blurb to Dana to make the connection.',
    'Want to see more? View the full notes', 'You should review Gemini\'s notes to make sure they\'re accurate.']
  const full = ['Full notes', 'Weekly sync', 'Summary', 'A summary.', 'Decisions', 'Aligned', 'Next steps',
    '[Alex Kim] Send deck: Email the deck and the latest report.',
    '[Sam Rivera] Intro to Dana: Forward the blurb to Dana to make the connection.', 'Details', 'Some detail line.']
  const doc = { tabs: [
    { documentTab: { body: { content: quick.map(para) } } },
    { documentTab: { body: { content: full.map(para) } } },
  ] }
  it('reads each step once, from the first Next steps list', () => {
    const steps = parseNextSteps(docToText(doc), ['Alex Kim'])
    expect(steps.map((s) => s.title)).toEqual(['Send deck', 'Intro to Dana'])
    expect(steps.map((s) => s.mine)).toEqual([true, false])
    expect(steps[1].owner).toBe('Sam Rivera')
  })
})
