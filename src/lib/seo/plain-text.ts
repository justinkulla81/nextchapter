// Turns authored report HTML into readable plain text for llms-full.txt:
// keeps headings, paragraphs, list items and table rows; drops charts,
// scripts, styles and buttons.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', middot: '·', times: '×', minus: '−',
}

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

export function htmlToPlainText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|svg|button|noscript)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
      .replace(/<\/(h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/(td|th)>/gi, ' | ')
      .replace(/<(br|\/p|\/tr|\/div|\/section|\/figcaption|\/blockquote|\/ul|\/ol|\/table)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
