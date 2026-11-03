import Link from 'next/link'
import { COMPANY_LINKS, PUBLIC_NAV } from '@/lib/nav/public-nav'

/** The footer's link columns: the same groups as the header menus, plus the company pages the header no longer carries. */
export function SiteFooterColumns({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  const heading = dark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-foreground'
  const link = dark ? 'text-sm text-white/80 underline-offset-4 hover:text-white hover:underline' : 'text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
  const columns = [
    ...PUBLIC_NAV.map((m) => ({ title: m.label, links: m.groups.flatMap((g) => g.links) })),
    { title: 'NextChapter', links: COMPANY_LINKS },
  ]
  return (
    <nav aria-label="Browse NextChapter" className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 pb-10 sm:grid-cols-3 lg:grid-cols-5">
      {columns.map((c) => (
        <div key={c.title}>
          <h2 className={heading}>{c.title}</h2>
          <ul className="mt-3 space-y-2">
            {c.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
