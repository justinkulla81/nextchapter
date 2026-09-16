import 'server-only'

// Shared Gmail MIME-walking helpers — originally written once for the
// candidate-facing email-tracking sync, extracted here so the admin-side
// sweep (a different OAuth connection, same API shape) can read a full
// message body without a second implementation to keep in sync.

export interface GmailHeader {
  name: string
  value: string
}
export interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string }
  parts?: GmailPart[]
}
export interface GmailMessage {
  id: string
  threadId?: string
  payload?: { headers?: GmailHeader[] } & GmailPart
}

export function findPartByMimeType(part: GmailPart | undefined, mimeType: string, depth = 0): string | null {
  if (!part || depth > 8) return null
  if (part.mimeType === mimeType && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8')
    } catch {
      return null
    }
  }
  for (const sub of part.parts ?? []) {
    const found = findPartByMimeType(sub, mimeType, depth + 1)
    if (found) return found
  }
  return null
}

// Crude but sufficient for regex keyword matching (never stored/rendered) —
// strip tags, decode the handful of entities real ATS templates actually
// use, collapse whitespace.
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(lt|gt|#39|quot);/gi, (m) => ({ '&lt;': '<', '&gt;': '>', '&#39;': "'", '&quot;': '"' })[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

// Gmail nests the actual text/plain part arbitrarily deep inside
// multipart/alternative and multipart/mixed containers — walk until one is
// found, and always append the text/html part (stripped) too rather than
// treating it as a last resort. Some templates put only a bare one-line
// summary in text/plain and leave every real detail solely in the HTML part;
// text/plain alone would silently starve a caller of the one signal it
// actually needed. Depth-capped defensively; real messages never nest this
// deep. `maxChars` is the caller's call — a few thousand for pattern
// matching, much more for an actual stored copy of the message.
export function extractEmailBody(part: GmailPart | undefined, maxChars: number): string {
  const plain = findPartByMimeType(part, 'text/plain') ?? ''
  const html = findPartByMimeType(part, 'text/html')
  const combined = html ? `${plain} ${stripHtml(html)}` : plain
  return combined.slice(0, maxChars)
}

// A part with a non-empty filename is an attachment (Gmail's convention —
// the inline body parts never carry one). Collects filenames (not content)
// so callers can pattern-match on how the file itself is named, e.g.
// "Jane_Doe_Resume.pdf", not just whether something was attached.
export function getAttachmentFilenames(part: GmailPart | undefined, depth = 0): string[] {
  if (!part || depth > 8) return []
  const own = part.filename ? [part.filename] : []
  return own.concat((part.parts ?? []).flatMap((sub) => getAttachmentFilenames(sub, depth + 1)))
}

export function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}
