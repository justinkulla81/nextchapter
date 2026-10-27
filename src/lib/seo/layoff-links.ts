import { getStateOrgList } from '@/lib/seo/org-pages'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import { getStateBoards } from '@/lib/seo/workforce-pages'
import { stateName, stateSlug } from '@/lib/seo/states'
import { hasLayoffStatePage } from '@/lib/warn/layoff-pages'

/**
 * Links from the layoff tracker to the state pages around it (rapid response, workforce boards, job centers, economic development
 * organizations, colleges) and from those state pages back. State-level only: Justin's rules (2026-10-25 and 10-26) keep
 * employer-named layoff content off employer, job center, economic development and workforce board pages. Each link is made only when its target page exists (a state
 * page is built only for a state that has the data), so a crawler never follows one into a 404.
 */
export interface CrossLink { label: string; href: string }

/** The pages that help people laid off in a state, each only if it exists. */
export async function stateHelpLinks(code: string): Promise<CrossLink[]> {
  const slug = stateSlug(code)
  const name = stateName(code)
  const [boards, centers, econ, colleges] = await Promise.all([
    getStateBoards(code).catch(() => []),
    getStateOrgList('JOB_CENTER', slug).catch(() => null),
    getStateOrgList('ECON_DEV', slug).catch(() => null),
    getStateCollegeListings(code).catch(() => []),
  ])
  const out: CrossLink[] = []
  if (boards.length) {
    out.push({ label: `${name} rapid response: who to call after a layoff notice`, href: `/rapid-response/${slug}` })
    out.push({ label: `${name} workforce boards (${boards.length})`, href: `/workforce-boards/${slug}` })
  }
  if (centers) out.push({ label: `American Job Centers in ${name}`, href: `/job-centers/${slug}` })
  if (econ) out.push({ label: `${name} economic development organizations`, href: `/economic-development/${slug}` })
  if (colleges.length) out.push({ label: `${name} colleges: retraining and career services`, href: `/higher-education/${slug}` })
  return out
}

/** The layoff tracker page for a state, when the state has notices in the last 12 months. */
export async function stateLayoffLink(code: string): Promise<CrossLink | null> {
  return (await hasLayoffStatePage(code)) ? { label: `${stateName(code)} layoff notices`, href: `/layoffs/${stateSlug(code)}` } : null
}

/** A state page's link to its layoff notices and its rapid response page, each only if it exists. */
export async function layoffAndRapidLinks(code: string): Promise<CrossLink[]> {
  const [layoffs, boards] = await Promise.all([stateLayoffLink(code), getStateBoards(code).catch(() => [])])
  const out: CrossLink[] = []
  if (layoffs) out.push(layoffs)
  if (boards.length) out.push({ label: `${stateName(code)} rapid response`, href: `/rapid-response/${stateSlug(code)}` })
  return out
}
