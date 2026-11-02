// What the shared capture block on a public SEO page says and where it points. One config per page, built from the page's kind.
// The three parts: the journey question (a person), the email save (a person), and the owner inquiry (an organization
// that runs, hires in or is listed on the page).

export type CaptureKind = 'state' | 'county' | 'city' | 'industry' | 'title' | 'company' | 'college'

export interface PageCaptureConfig {
  kind: CaptureKind
  /** The page's slug, lowercase, letters digits and dashes only. */
  slug: string
  /** What the page is about, for headings: "Ohio", "Columbus", "Health care", "Software engineer", "Acme", "Ohio State". */
  label: string
  /** The saved job search behind the email box. Leave out when the page renders its own SaveSearchForm. */
  save?: { q: string; loc: string }
}

/** The `source` stored on the journey lead and the owner inquiry: `page:<kind>:<slug>`. Matched by the allowlists in the actions. */
export function captureSource(c: Pick<PageCaptureConfig, 'kind' | 'slug'>): string {
  return `page:${c.kind}:${c.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 70)}`
}

/** The `source` a saved search stores (page:<kind>, no slug; the search itself says which page). */
export const SAVE_SOURCE_KINDS = ['employer', 'title', 'salary', 'place', 'industry', 'college', 'company'] as const
export function saveSource(kind: CaptureKind): string {
  if (kind === 'state' || kind === 'county' || kind === 'city') return 'page:place'
  return `page:${kind}`
}

export interface OwnerOffer {
  /** The line that says who this is for. */
  who: string
  /** What they get. */
  what: string
  /** The full page for the same audience. */
  href: string
  hrefLabel: string
}

/** Who owns, hires on or is listed on this kind of page, and where the longer conversation happens. */
export function ownerOffer(c: PageCaptureConfig): OwnerOffer {
  switch (c.kind) {
    case 'state':
    case 'county':
    case 'city':
      return {
        who: `Run a workforce board, job center or economic development office, or hire in ${c.label}?`,
        what: `Leave your work email. We'll send how organizations use NextChapter to reach job seekers in ${c.label}.`,
        href: '/for-organizations',
        hrefLabel: 'See how organizations use it',
      }
    case 'industry':
      return {
        who: `Hire in ${c.label.toLowerCase()} or run an association for it?`,
        what: `Leave your work email. We'll send how to reach experienced ${c.label.toLowerCase()} professionals on NextChapter.`,
        href: '/employers',
        hrefLabel: 'See employer options',
      }
    case 'title':
      return {
        who: `Hiring ${c.label.toLowerCase()} roles?`,
        what: `Leave your work email. We'll send how to reach people searching for ${c.label.toLowerCase()} jobs.`,
        href: '/employers',
        hrefLabel: 'See employer options',
      }
    case 'company':
      return {
        who: `Work at ${c.label}?`,
        what: `Leave your work email. We'll send how ${c.label} can claim this page and reach its people.`,
        href: '/for-organizations',
        hrefLabel: 'See how organizations use it',
      }
    case 'college':
      return {
        who: `Work in career services or alumni relations at ${c.label}?`,
        what: `Leave your work email. We'll send how ${c.label} can claim this page for its students and alumni.`,
        href: '/higher-education',
        hrefLabel: 'See what colleges get',
      }
  }
}

/** The email save box copy. */
export function saveCopy(c: PageCaptureConfig): { heading: string; blurb: string; cta: string } {
  switch (c.kind) {
    case 'title':
      return { heading: `Get new ${c.label.toLowerCase()} jobs by email`, blurb: 'We’ll email you when new matches are posted. No account needed.', cta: 'Email me new jobs' }
    case 'industry':
      return { heading: `Follow ${c.label.toLowerCase()}`, blurb: `We’ll email you new ${c.label.toLowerCase()} openings. No account needed.`, cta: 'Follow by email' }
    case 'company':
      return { heading: `Follow ${c.label}`, blurb: `We’ll email you when ${c.label} posts a role. No account needed.`, cta: 'Follow by email' }
    case 'college':
      return { heading: `Follow ${c.label}`, blurb: `We’ll email you new jobs for ${c.label} students and alumni. No account needed.`, cta: 'Follow by email' }
    default:
      return { heading: `Follow ${c.label}`, blurb: `We’ll email you when new jobs are posted in ${c.label}. No account needed.`, cta: 'Follow by email' }
  }
}
