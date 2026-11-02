// Pulls course links and page facts out of fetched HTML. Pure; tested in src/test/course-scan.test.ts.

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim()
}

/** Every `<a href>` on the page as an absolute URL (fragment and query dropped) with its visible text. */
export function extractLinks(html: string, baseUrl: string): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*?href="([^"#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string
    try {
      const u = new URL(decodeEntities(m[1]), baseUrl)
      u.search = ''
      url = u.toString().replace(/\/+$/, '')
    } catch {
      continue
    }
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url, text: decodeEntities(m[2].replace(/<[^>]+>/g, ' ')) })
  }
  return out
}

function meta(html: string, prop: string): string | null {
  const m =
    new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i').exec(html) ??
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i').exec(html)
  return m ? decodeEntities(m[1]) : null
}

/** Title and description of a course page, for a candidate found only as a bare link. */
export function pageFacts(html: string): { title: string | null; description: string | null } {
  const t = meta(html, 'og:title') ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return { title: t ? decodeEntities(t).replace(/\s*[|–-]\s*(Google|Anthropic|DeepLearning\.AI|Microsoft Learn).*$/i, '') : null, description: meta(html, 'og:description') ?? meta(html, 'description') }
}
