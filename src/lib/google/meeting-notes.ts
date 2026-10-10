// Pure helpers for reading a Google Meet link and its Gemini notes off a
// Calendar event. Kept free of 'server-only' and fetch so they can be tested.

export interface CalendarAttachment {
  fileId?: string
  fileUrl?: string
  title?: string
  mimeType?: string
}

export interface NotesDoc {
  fileId: string
  url: string
  title: string
}

const GOOGLE_DOC = 'application/vnd.google-apps.document'

/** The Meet join link: the event's hangoutLink, else its video entry point. */
export function meetUrlOf(ev: {
  hangoutLink?: string
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] }
}): string | null {
  if (ev.hangoutLink) return ev.hangoutLink
  const video = ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video' && p.uri)
  return video?.uri ?? null
}

/**
 * The "Notes by Gemini" document among an event's attachments.
 *
 * Meet attaches the notes doc (and a separate transcript doc) to the event
 * once the call ends. Only the notes are wanted: the transcript is long,
 * verbatim, and a much heavier thing to store on someone's record.
 */
export function geminiNotesDocOf(attachments: CalendarAttachment[] | undefined): NotesDoc | null {
  for (const a of attachments ?? []) {
    if (a.mimeType !== GOOGLE_DOC || !a.fileId || !a.fileUrl) continue
    if (/notes by gemini|gemini notes/i.test(a.title ?? '')) {
      return { fileId: a.fileId, url: a.fileUrl, title: a.title ?? 'Notes by Gemini' }
    }
  }
  return null
}

interface DocElement { textRun?: { content?: string } }
interface DocStructural {
  paragraph?: { elements?: DocElement[] }
  table?: { tableRows?: { tableCells?: { content?: DocStructural[] }[] }[] }
}
interface DocTab { documentTab?: { body?: { content?: DocStructural[] } }; childTabs?: DocTab[] }
export interface GoogleDocJson {
  body?: { content?: DocStructural[] }
  tabs?: DocTab[]
}

function structuralText(items: DocStructural[] | undefined): string[] {
  const lines: string[] = []
  for (const item of items ?? []) {
    if (item.paragraph) {
      const text = (item.paragraph.elements ?? []).map((e) => e.textRun?.content ?? '').join('').replace(/\s+$/, '')
      if (text.trim()) lines.push(text)
    } else if (item.table) {
      for (const row of item.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) lines.push(...structuralText(cell.content))
      }
    }
  }
  return lines
}

function tabText(tabs: DocTab[] | undefined): string[] {
  const out: string[] = []
  for (const t of tabs ?? []) {
    out.push(...structuralText(t.documentTab?.body?.content), ...tabText(t.childTabs))
  }
  return out
}

/** Docs API JSON to plain text — paragraphs and table cells, one per line. */
export function docToText(doc: GoogleDocJson): string {
  const lines = doc.tabs?.length ? tabText(doc.tabs) : structuralText(doc.body?.content)
  return lines.join('\n').trim()
}

/** A stored note is capped: it is a pointer to the doc, not a copy of it. */
export const NOTES_BODY_LIMIT = 20_000

export function capNotes(text: string): string {
  return text.length <= NOTES_BODY_LIMIT ? text : `${text.slice(0, NOTES_BODY_LIMIT - 1)}…`
}
