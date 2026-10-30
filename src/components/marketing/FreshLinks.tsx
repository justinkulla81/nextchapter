import { TrackedLink } from '@/components/marketing/TrackedLink'
import { getFreshJobLinks, getFreshLayoffLinks, type FreshLink } from '@/lib/seo/fresh-links'

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

export async function FreshLinks({ tone, placement }: { tone: 'dark' | 'light'; placement: string }) {
  const [layoffs, jobs] = await Promise.all([getFreshLayoffLinks(), getFreshJobLinks()])
  if (layoffs.length === 0 && jobs.length === 0) return null
  return (
    <div className={tone === 'dark' ? 'mt-12 space-y-6 text-left' : 'space-y-6'}>
      <LinkList title="Latest layoffs" links={layoffs} placement={placement} tone={tone} />
      <LinkList title="Newest jobs with pay listed" links={jobs} placement={placement} tone={tone} />
    </div>
  )
}
