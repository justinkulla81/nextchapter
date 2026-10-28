import 'server-only'
import type { LocalPicture } from './layoff-picture'
import type { DraftContext } from './layoff-alert-drafts'
import { employerSlug } from './layoff-pages'
import { stateSlug } from '@/lib/seo/states'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import { composeKey } from './layoff-alert-drafts'

const SITE = 'https://launchyournextchapter.com'

/**
 * The two pages the drafted notes link besides a partner's own: the page for the people leaving the employer, and the
 * layoff's county page. The county page is used only when it answers (a county with no page would be a dead link in an
 * email); a slow or failed check just drops it, and the note links the state page instead.
 */
export async function draftContext(picture: LocalPicture, employer: string, state: string | null, county: string | null, noticeId: string): Promise<DraftContext> {
  const peoplePage = `${SITE}/network/company/${employerSlug(employer, null)}`
  const countySlug = county ? `${county.replace(/\s+county$/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-county` : null
  const url = countySlug && state ? `${SITE}/places/${stateSlug(state)}/county/${countySlug}` : null
  const localPage = url && (await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(4000) }).then((r) => r.status === 200, () => false)) ? url : null
  // A click on a Write email button is counted (layoff_alert_compose_clicked) and then opens Gmail; with no signing secret the plain link is used.
  const track = (href: string, meta: { group: string; variant: string | undefined; personId: string | undefined }) => buildEmailClickUrl(SITE, 'admin', composeKey(meta.group, meta.variant, noticeId, meta.personId), href)
  return { picture, peoplePage, localPage, track }
}
