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
