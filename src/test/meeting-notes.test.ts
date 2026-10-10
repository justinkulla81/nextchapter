import { describe, it, expect } from 'vitest'
import { meetUrlOf, geminiNotesDocOf, docToText, capNotes, NOTES_BODY_LIMIT } from '@/lib/google/meeting-notes'

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
