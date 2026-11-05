// What the shared capture block on a public SEO page says and where it points. One config per page, built from the page's kind.
// The three parts: the journey question (a person), the email save (a person), and the owner inquiry (an organization
// that runs, hires in or is listed on the page).

export type CaptureKind = 'state' | 'county' | 'city' | 'industry' | 'function' | 'title' | 'company' | 'college' | 'ranking'

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
export const SAVE_SOURCE_KINDS = ['employer', 'title', 'salary', 'place', 'industry', 'function', 'college', 'company', 'ranking'] as const
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
        who: `Job seekers in ${c.label} looking to you for help, or openings you cannot fill?`,
        what: `Leave your work email. We'll send how organizations use NextChapter to reach job seekers in ${c.label}.`,
        href: '/for-organizations',
        hrefLabel: 'See how organizations use it',
      }
    case 'industry':
      return {
        who: `Hiring in ${c.label.toLowerCase()} and not seeing enough experienced applicants?`,
        what: `Leave your work email. We'll send how to reach experienced ${c.label.toLowerCase()} professionals on NextChapter.`,
        href: '/employers',
        hrefLabel: 'See employer options',
      }
    case 'function':
      return {
        who: `Hiring in ${c.label.toLowerCase()} and not seeing enough experienced applicants?`,
        what: `Leave your work email. We'll send how to reach experienced ${c.label.toLowerCase()} professionals on NextChapter.`,
        href: '/employers',
        hrefLabel: 'See employer options',
      }
    case 'title':
      return {
        who: `Hiring ${c.label.toLowerCase()} roles and not seeing the right people?`,
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
    case 'ranking':
      return {
        who: 'Run a workforce board, job center or economic development office, or hire in the places and industries on this list?',
        what: 'Leave your work email. We\'ll send how organizations use NextChapter to reach job seekers.',
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

/** The email save box copy: the pain (checking boards by hand), the payoff (new matches in the inbox). `follow` names what is followed, for the signed-in one-button box. */
export function saveCopy(c: PageCaptureConfig): { heading: string; follow: string; blurb: string; cta: string } {
  const heading = 'Tired of checking job boards every day?'
  const cta = 'Email me new jobs'
  switch (c.kind) {
    case 'title':
      return { heading, follow: `${c.label.toLowerCase()} jobs`, blurb: `We email you new ${c.label.toLowerCase()} jobs when they are posted. No account needed.`, cta }
    case 'function':
      return { heading, follow: `${c.label.toLowerCase()} jobs`, blurb: `We email you new ${c.label.toLowerCase()} openings. No account needed.`, cta }
    case 'industry':
      return { heading, follow: c.label.toLowerCase(), blurb: `We email you new ${c.label.toLowerCase()} openings. No account needed.`, cta }
    case 'company':
      return { heading: `Want to know when ${c.label} is hiring?`, follow: c.label, blurb: `We email you when ${c.label} posts a role. No account needed.`, cta }
    case 'college':
      return { heading: `Looking for work after ${c.label}?`, follow: c.label, blurb: `We email you new jobs for ${c.label} students and alumni. No account needed.`, cta }
    case 'ranking':
      return { heading, follow: `new ${c.label} jobs`, blurb: 'We email you when new matches are posted. No account needed.', cta }
    default:
      return { heading: `Missing the jobs in ${c.label}?`, follow: c.label, blurb: `We email you when new jobs are posted in ${c.label}. No account needed.`, cta }
  }
}
