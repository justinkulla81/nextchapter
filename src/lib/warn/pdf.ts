import { inflateSync, inflateRawSync } from 'zlib'

/**
 * Pulls the text out of a PDF without a PDF library.
 *
 * State WARN notices are frequently posted as PDFs of the employer's own
 * letter, and the numbers that matter — affected workers, industry type —
 * exist nowhere else. A full PDF parser is not needed to read them: the text
 * is in content streams as PostScript string literals, and collecting those
 * in order recovers enough to match a labelled field.
 *
 * What this deliberately does not do is lay text out. Words come back in
 * stream order with no reliable spacing, so match on a label and a number,
 * never on a phrase's exact shape.
 */
export function pdfText(buf: Buffer): string {
  const out: string[] = []

  for (const stream of contentStreams(buf)) {
    let i = 0
    const n = stream.length
    while (i < n) {
      const c = stream[i]

      // ( … ) literal string, which may nest and may escape.
      if (c === 0x28) {
        let depth = 1
        let j = i + 1
        const chunk: number[] = []
        while (j < n && depth > 0) {
          const ch = stream[j]
          if (ch === 0x5c) {
            const next = stream[j + 1]
            const simple: Record<number, number> = {
              0x6e: 0x0a, 0x72: 0x0d, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c,
              0x28: 0x28, 0x29: 0x29, 0x5c: 0x5c,
            }
            if (next in simple) { chunk.push(simple[next]); j += 2; continue }
            // Octal escape, one to three digits.
            let oct = ''
            let k = j + 1
            while (k < n && oct.length < 3 && stream[k] >= 0x30 && stream[k] <= 0x37) {
              oct += String.fromCharCode(stream[k]); k++
            }
            if (oct) { chunk.push(parseInt(oct, 8) & 0xff); j = k; continue }
            j += 2
            continue
          }
          if (ch === 0x28) depth++
          else if (ch === 0x29) { depth--; if (depth === 0) break }
          chunk.push(ch)
          j++
        }
        out.push(Buffer.from(chunk).toString('latin1'))
        i = j + 1
        continue
      }

      // < … > hex string (but not the << dictionary opener).
      if (c === 0x3c && stream[i + 1] !== 0x3c) {
        const end = stream.indexOf(0x3e, i)
        if (end > 0) {
          const hex = stream.subarray(i + 1, end).toString('latin1').replace(/[^0-9a-fA-F]/g, '')
          if (hex.length && hex.length % 2 === 0) {
            out.push(Buffer.from(hex, 'hex').toString('latin1'))
          }
          i = end + 1
          continue
        }
      }
      i++
    }
  }

  // Font and image streams decode to bytes that are not text, and a NUL byte
  // reaching Postgres fails the whole insert with "invalid byte sequence for
  // encoding UTF8". Control characters are stripped here rather than at each
  // call site so no caller can forget.
  return out.join('').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
}

/** Inflates every stream object; skips the ones that are not deflate. */
function contentStreams(buf: Buffer): Buffer[] {
  const streams: Buffer[] = []
  const haystack = buf.toString('latin1')
  const re = /stream\r?\n/g
  let m: RegExpExecArray | null

  while ((m = re.exec(haystack)) !== null) {
    const start = m.index + m[0].length
    const end = haystack.indexOf('endstream', start)
    if (end === -1) continue
    const raw = buf.subarray(start, end)
    for (const attempt of [inflateSync, inflateRawSync]) {
      try {
        streams.push(attempt(raw))
        break
      } catch {
        // Not a deflate stream (images, fonts, already-plain content).
      }
    }
  }
  return streams
}

/**
 * Finds a number that follows a label.
 *
 * Extracted PDF text loses spacing, so both the label and the haystack are
 * stripped to letters and digits before matching — "N er o A ec ed W rk ers"
 * and "Number of Affected Workers" collapse to comparable strings only if the
 * missing characters are tolerated, which is why the label is matched as a
 * loose sequence rather than a literal.
 */
export function labelledNumber(text: string, label: string): number | null {
  const flat = text.toLowerCase().replace(/[^a-z0-9:]/g, '')
  const want = label.toLowerCase().replace(/[^a-z0-9]/g, '')
  const idx = flat.indexOf(want)
  if (idx === -1) return null
  const after = flat.slice(idx + want.length, idx + want.length + 12)
  const m = after.match(/^:?(\d{1,6})/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
