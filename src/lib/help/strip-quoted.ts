// A reply by email carries the whole conversation below the new text. Keep only
// what the person just wrote: cut at the first sign of quoted history.

const CUTOFFS: RegExp[] = [
  /^\s*On .{5,200}wrote:\s*$/im, // Gmail, Apple Mail
  /^\s*On .{5,200}$\n^\s*.{0,200}wrote:\s*$/im, // wrapped "On <date>,\n<name> wrote:"
  /^\s*-{2,}\s*Original Message\s*-{2,}/im, // Outlook
  /^\s*From:\s.+\n\s*(Sent|Date):\s/im, // Outlook header block
  /^\s*(—|-)+\s*Earlier in this conversation\s*(—|-)+/im, // our own marker
  /^\s*Earlier in this conversation\s*$/im,
  /^\s*_{5,}\s*$/m,
]

export function stripQuotedReply(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n')
  let cut = text.length
  for (const re of CUTOFFS) {
    const m = re.exec(text)
    if (m && m.index < cut) cut = m.index
  }
  text = text.slice(0, cut)
  // A leftover run of "> quoted" lines at the end.
  const lines = text.split('\n')
  while (lines.length && (lines[lines.length - 1].trim() === '' || lines[lines.length - 1].trimStart().startsWith('>'))) lines.pop()
  text = lines.join('\n')
  // The signature separator and anything after it.
  const sig = text.search(/\n-- ?\n/)
  if (sig !== -1) text = text.slice(0, sig)
  return text.trim()
}
