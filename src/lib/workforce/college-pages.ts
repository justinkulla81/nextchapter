import * as cheerio from 'cheerio'

/**
 * Finding a college's department pages from its homepage, and reading them
 * as plain text, for pulling out who runs career services, alumni
 * relations, development and executive education.
 */
export const COLLEGE_ROLES = {
  career: {
    label: 'Career services',
    // "Careers" alone is usually jobs at the college, not its career center.
    link: /\bcareer\s*(services|center|centre|development|success|education|and professional|&\s*professional|readiness|connections?|hub|office)\b|\bhandshake\b/i,
  },
  alumni: { label: 'Alumni relations', link: /\balumni\b/i },
  development: {
    label: 'Development',
    link: /\b(advancement|development office|office of development|university development|college development|philanthropy|giving|give now|ways to give|foundation)\b/i,
  },
  execEd: {
    label: 'Executive / continuing education',
    link: /\b(executive education|exec ed|continuing (education|studies)|professional (education|studies|development programs?)|lifelong learning|workforce (development|training|education)|non-?credit)\b/i,
  },
} as const
export type CollegeRole = keyof typeof COLLEGE_ROLES

/**
 * Where an office usually lives when the homepage does not link it:
 * a subdomain or a path on the main site.
 */
const USUAL_PLACES: Record<CollegeRole, { sub: string[]; path: string[] }> = {
  career: { sub: ['career', 'careers', 'careercenter'], path: ['career-center', 'career-services', 'careercenter', 'career', 'careers/career-services'] },
  alumni: { sub: ['alumni'], path: ['alumni', 'alumni-relations'] },
  development: { sub: ['giving', 'give', 'advancement', 'foundation'], path: ['giving', 'advancement', 'foundation', 'give'] },
  execEd: { sub: ['ce', 'continuinged', 'execed', 'pace'], path: ['continuing-education', 'ce', 'workforce', 'executive-education', 'professional-education', 'continuing-studies'] },
}

export function usualPlaces(role: CollegeRole, home: string): string[] {
  const u = new URL(home)
  const domain = u.hostname.replace(/^www\./, '')
  return [
    ...USUAL_PLACES[role].sub.map((s) => `https://${s}.${domain}/`),
    ...USUAL_PLACES[role].path.map((p) => `${u.origin}/${p}/`),
  ]
}

/** On a department's page, the link to its people. */
const STAFF_LINK = /\b(staff|our team|meet (the|our) (team|staff)|directory|leadership|who we are|about us|contact us|people)\b/i

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
/** About 2,000 tokens of text per page. */
const PAGE_CHARS = 8_000

export interface PageText { url: string; role: CollegeRole | 'home'; text: string }

type Link = { href: string; text: string }

export function pageLinks(html: string, base: string): Link[] {
  const $ = cheerio.load(html)
  const out: Link[] = []
  $('a[href]').each((_, a) => {
    const raw = $(a).attr('href') ?? ''
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) return
    try {
      const url = new URL(raw, base)
      if (!/^https?:$/.test(url.protocol)) return
      url.hash = ''
      out.push({ href: url.toString(), text: `${$(a).text()} ${$(a).attr('title') ?? ''} ${$(a).attr('aria-label') ?? ''}`.replace(/\s+/g, ' ').trim() })
    } catch { /* not a URL */ }
  })
  return out
}

/** The college's own sites: its domain and subdomains, never social media or a portal elsewhere. */
export function sameSite(href: string, home: string): boolean {
  try {
    const root = (h: string) => new URL(h).hostname.replace(/^www\./, '').split('.').slice(-2).join('.')
    return root(href) === root(home)
  } catch { return false }
}

/** The best link for a role: its words in the link text, or failing that in the address. */
export function pickRoleLink(links: Link[], role: CollegeRole, home: string): string | null {
  const re = COLLEGE_ROLES[role].link
  // News stories and events mention offices; they are not the office's page.
  const own = links.filter((l) => sameSite(l.href, home) && !/\.(pdf|jpe?g|png|docx?)$/i.test(l.href)
    && !/\/(news|events?|blog|stories|story|calendar|magazine|press)(\/|-|$)/i.test(new URL(l.href).pathname))
  const byText = own.find((l) => re.test(l.text))
  if (byText) return byText.href
  const byPath = own.find((l) => re.test(decodeURIComponent(new URL(l.href).pathname).replace(/[-_/]+/g, ' ')))
  return byPath?.href ?? null
}

export function pickStaffLink(links: Link[], from: string): string | null {
  return links.find((l) => sameSite(l.href, from) && l.href !== from && STAFF_LINK.test(l.text))?.href ?? null
}

/** A page's readable text, with each email and phone kept, navigation and scripts dropped. */
export function pageText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, svg, iframe, header nav, footer nav').remove()
  // Keep the address of a mailto link even when its text is "Email".
  $('a[href^="mailto:"]').each((_, a) => {
    const email = ($(a).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0]
    if (email && !$(a).text().includes(email)) $(a).append(` (${email})`)
  })
  const main = $('main').length ? $('main') : $('body')
  return main.text().replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, PAGE_CHARS)
}

async function getPage(url: string, timeoutMs = 15_000): Promise<{ html: string; url: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
    return { html: await res.text(), url: res.url || url }
  } catch {
    return null
  }
}

/**
 * Reads a college's homepage, then for each role its department page and
 * that page's staff page if it links one. At most nine pages; a site that
 * renders everything with JavaScript yields little, and that is accepted.
 */
export async function readCollegePages(website: string): Promise<PageText[]> {
  const home = await getPage(website)
  if (!home) return []
  const homeLinks = pageLinks(home.html, home.url)
  const seen = new Set<string>([home.url])
  // The four offices are read at once; each finds its own page and staff page.
  const readRole = async (role: CollegeRole): Promise<PageText[]> => {
    let dept: { html: string; url: string } | null = null
    const linked = pickRoleLink(homeLinks, role, home.url)
    if (linked && !seen.has(linked)) {
      seen.add(linked)
      dept = await getPage(linked)
    }
    // Not linked from the homepage (or the link failed): try where it usually is,
    // keeping a page only if it is about the office. Guesses get a short wait.
    if (!dept) {
      for (const guess of usualPlaces(role, home.url)) {
        if (seen.has(guess)) continue
        seen.add(guess)
        const page = await getPage(guess, 6_000)
        if (page && !seen.has(page.url) && COLLEGE_ROLES[role].link.test(pageText(page.html).slice(0, 3000))) { dept = page; break }
      }
    }
    if (!dept) return []
    seen.add(dept.url)
    const out: PageText[] = [{ url: dept.url, role, text: pageText(dept.html) }]
    const staffUrl = pickStaffLink(pageLinks(dept.html, dept.url), dept.url)
    if (staffUrl && !seen.has(staffUrl)) {
      seen.add(staffUrl)
      const staff = await getPage(staffUrl)
      if (staff) out.push({ url: staff.url, role, text: pageText(staff.html) })
    }
    return out
  }
  const pages = (await Promise.all((Object.keys(COLLEGE_ROLES) as CollegeRole[]).map(readRole))).flat()
  return pages.filter((p) => p.text.length > 200)
}
