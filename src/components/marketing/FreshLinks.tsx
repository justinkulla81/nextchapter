import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PRIORITY_RANKINGS, PRIORITY_TOOLS } from '@/lib/seo/priority-links'
import { getFreshJobLinks, getFreshLayoffLinks, getRisingSearchLinks, type FreshLink } from '@/lib/seo/fresh-links'

// Newest layoff pages and job pages as a plain link list. `tone` matches the surface it sits on: 'dark' for the home footer,
// 'light' for /news. Renders nothing when there is nothing to list.

function LinkList({ title, links, placement, tone }: { title: string; links: FreshLink[]; placement: string; tone: 'dark' | 'light' }) {
  if (links.length === 0) return null
  const heading = tone === 'dark' ? 'text-white' : 'text-navy'
  const link = tone === 'dark' ? 'text-white/80 underline-offset-4 hover:text-white hover:underline' : 'text-brand underline-offset-4 hover:underline'
  return (
    <div>
      <h2 className={`text-sm font-semibold ${heading}`}>{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <TrackedLink href={l.href} event="fresh_link_clicked" properties={{ kind: l.kind, key: l.key, placement }} className={link}>
              {l.label}
            </TrackedLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

const asLinks = (items: { href: string; label: string }[], kind: FreshLink['kind']): FreshLink[] => items.map((i) => ({ label: i.label, href: i.href, kind, key: i.href }))

export async function FreshLinks({ tone, placement }: { tone: 'dark' | 'light'; placement: string }) {
  const [layoffs, jobs, rising] = await Promise.all([getFreshLayoffLinks(), getFreshJobLinks(), getRisingSearchLinks(8)])
  if (layoffs.length === 0 && jobs.length === 0 && rising.length === 0) return null
  return (
    <div className={tone === 'dark' ? 'mt-12 space-y-6 text-left' : 'space-y-6'}>
      <LinkList title="Latest layoffs" links={layoffs} placement={placement} tone={tone} />
      <LinkList title="Newest jobs" links={jobs} placement={placement} tone={tone} />
      <LinkList title="Searched for lately" links={rising} placement={placement} tone={tone} />
      <LinkList title="Free tools" links={asLinks(PRIORITY_TOOLS, 'tool')} placement={placement} tone={tone} />
      <LinkList title="Rankings" links={asLinks(PRIORITY_RANKINGS, 'ranking')} placement={placement} tone={tone} />
    </div>
  )
}

/**
 * The newest layoff pages as a plain link list for the layoff hub. The hub's tracker table is drawn in the browser, so without
 * this list the newest announcements (employers with no WARN filing) have no link a crawler can follow from /layoffs.
 */
export async function LatestLayoffLinks({ limit, placement, tone }: { limit: number; placement: string; tone: 'dark' | 'light' }) {
  const layoffs = await getFreshLayoffLinks(limit)
  return <LinkList title="Latest layoffs" links={layoffs} placement={placement} tone={tone} />
}

/** Pages that already show on the edge of page one, linked with the search as the text. For the layoff hub. */
export async function RisingSearchLinks({ limit, placement, tone, prefixes }: { limit: number; placement: string; tone: 'dark' | 'light'; prefixes?: readonly string[] }) {
  const links = await getRisingSearchLinks(limit, prefixes)
  return <LinkList title="Searched for lately" links={links} placement={placement} tone={tone} />
}
