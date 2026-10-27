import Link from 'next/link'
import { BROWSE_LINKS } from '@/lib/seo/browse-links'

// A plain list of the hub pages (src/lib/seo/browse-links.ts), for pages Google already crawls.
export function BrowseTheSite({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <nav aria-label="Browse NextChapter" className={dark ? 'mx-auto max-w-4xl px-6 pb-8 text-center' : 'mt-12 border-t border-border pt-6'}>
      <h2 className={dark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-foreground'}>Browse NextChapter</h2>
      <ul className={`mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm ${dark ? 'justify-center text-white/80' : 'text-muted-foreground'}`}>
        {BROWSE_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={dark ? 'underline-offset-4 hover:text-white hover:underline' : 'underline underline-offset-4 hover:text-foreground'}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
