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
    // A real event's attachment can be just { fileUrl, title } — no fileId and
    // no mimeType — so the document id comes from the link when it's absent.
    if (!a.fileUrl) continue
    if (a.mimeType && a.mimeType !== GOOGLE_DOC) continue
    if (!/notes by gemini|gemini notes/i.test(a.title ?? '')) continue
    const fileId = a.fileId ?? a.fileUrl.match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1]
    if (!fileId) continue
    return { fileId, url: a.fileUrl, title: a.title ?? 'Notes by Gemini' }
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

export interface NextStep {
  /** Who Gemini assigned it to, as written ("Justin Kulla"), or null. */
  owner: string | null
  title: string
  detail: string | null
  /** Assigned to you (any listed owner matches one of your names). */
  mine: boolean
}

const NEXT_STEPS_HEADING = /^(suggested\s+)?next\s+steps?:?$/i
const OTHER_HEADING = /^(summary|decisions?|details|more details|key points|attachments?|transcript)\s*:?$/i

/**
 * The action items in a Gemini notes doc: lines of the form
 * "[Owner] Title: detail" under its "Next steps" heading. Lines without an
 * owner in brackets are skipped — a stray sentence is not worth a to-do.
 * `selfNames` are the display names that are you; matching is case-insensitive
 * and on whole names or a first-name match, since Gemini writes either.
 */
export function parseNextSteps(text: string, selfNames: string[]): NextStep[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const start = lines.findIndex((l) => NEXT_STEPS_HEADING.test(l))
  if (start === -1) return []
  const selves = selfNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
  const isMe = (owner: string) => {
    const o = owner.toLowerCase()
    return selves.some((s) => o === s || o.split(/\s+/)[0] === s.split(/\s+/)[0])
  }
  const steps: NextStep[] = []
  for (const line of lines.slice(start + 1)) {
    if (OTHER_HEADING.test(line)) break
    const m = line.match(/^\[([^\]]+)\]\s*(.+)$/)
    if (!m) continue
    const owners = m[1].split(/,|\band\b|&/).map((o) => o.trim()).filter(Boolean)
    const rest = m[2].trim()
    const colon = rest.indexOf(': ')
    const title = (colon > 0 ? rest.slice(0, colon) : rest).trim()
    const detail = colon > 0 ? rest.slice(colon + 2).trim() : null
    if (!title) continue
    steps.push({ owner: m[1].trim(), title, detail, mine: owners.some(isMe) })
  }
  return steps
}
