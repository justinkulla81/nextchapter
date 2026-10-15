// Server-side validation for user-supplied files that land in storage.
//
// What the client sends is not evidence of anything: file.name and file.type
// are free text. Two real problems came from trusting them: the storage key's
// extension and Content-Type were taken from the filename/type, so an .html or
// .svg file could be hosted from the project's storage origin (some buckets are
// public), and nothing checked the bytes were what the extension claimed.
//
// This decides the extension and Content-Type itself, from the file's own
// leading bytes, within an allowlist per use. SVG is never accepted: it is an
// image format that can carry script.

export type UploadKind = 'image' | 'resume' | 'workSample' | 'requestedDocument'

type Detected = { ext: string; contentType: string }

const TYPES: Record<string, Detected> = {
  png: { ext: 'png', contentType: 'image/png' },
  jpg: { ext: 'jpg', contentType: 'image/jpeg' },
  gif: { ext: 'gif', contentType: 'image/gif' },
  webp: { ext: 'webp', contentType: 'image/webp' },
  pdf: { ext: 'pdf', contentType: 'application/pdf' },
  docx: { ext: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pptx: { ext: 'pptx', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  xlsx: { ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  txt: { ext: 'txt', contentType: 'text/plain; charset=utf-8' },
  csv: { ext: 'csv', contentType: 'text/csv; charset=utf-8' },
  md: { ext: 'md', contentType: 'text/plain; charset=utf-8' },
}

const ALLOWED: Record<UploadKind, string[]> = {
  image: ['png', 'jpg', 'gif', 'webp'],
  resume: ['pdf', 'docx'],
  workSample: ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg', 'gif', 'webp', 'txt', 'csv', 'md'],
  // Things a coach or office asks for: letters, forms, scans, spreadsheets.
  requestedDocument: ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'txt', 'csv'],
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)

function sniff(head: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | 'pdf' | 'zip' | 'text' | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpg'
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'gif'
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'zip'
  // Plain text: no NUL or other control bytes in the sampled head.
  if (head.length > 0 && head.every((v) => v === 9 || v === 10 || v === 13 || v >= 32)) return 'text'
  return null
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : ''
}

export type UploadCheck = { ok: true; ext: string; contentType: string } | { ok: false; error: string }

/**
 * Checks size, extension allowlist and leading bytes, and returns the
 * extension and Content-Type to store under (never the client's).
 */
export async function validateUpload(file: File, kind: UploadKind, maxBytes: number): Promise<UploadCheck> {
  if (file.size === 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > maxBytes) return { ok: false, error: `That file is too large. The limit is ${Math.round(maxBytes / (1024 * 1024))} MB.` }

  const claimed = extOf(file.name)
  const allowed = ALLOWED[kind]
  if (!allowed.includes(claimed)) {
    return { ok: false, error: `That file type isn't supported. Use ${allowed.map((e) => e.toUpperCase()).join(', ')}.` }
  }

  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  const detected = sniff(head)
  const matches =
    (claimed === 'png' && detected === 'png') ||
    (claimed === 'jpg' && detected === 'jpg') ||
    (claimed === 'gif' && detected === 'gif') ||
    (claimed === 'webp' && detected === 'webp') ||
    (claimed === 'pdf' && detected === 'pdf') ||
    (['docx', 'pptx', 'xlsx'].includes(claimed) && detected === 'zip') ||
    (['txt', 'csv', 'md'].includes(claimed) && detected === 'text')
  if (!matches) return { ok: false, error: "That file doesn't look like the type its name says. Please upload the original file." }

  const t = TYPES[claimed]
  return { ok: true, ext: t.ext, contentType: t.contentType }
}
