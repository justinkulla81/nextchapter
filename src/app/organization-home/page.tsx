import type { Metadata } from 'next'
import Link from 'next/link'
import { Briefcase, GraduationCap, HeartHandshake, LifeBuoy } from 'lucide-react'
import { NOINDEX } from '@/lib/seo/canonical'
import { portalHostOn } from '@/lib/portal-hosts'

export const metadata: Metadata = { ...NOINDEX, title: 'NextChapter for organizations' }

// The organization portal's front door (organization.<site>): one place for
// an employer's work with NextChapter. Retention and L&D join as they ship.
export default function OrganizationHome() {
  const on = portalHostOn('organization')
  const hiring = on ? '/hiring' : '/talent/dashboard'
  const outplacement = on ? '/outplacement' : '/employer'
  const tiles = [
    { icon: Briefcase, title: 'Hiring', body: 'Post roles, see matched candidates who chose to be seen, and ask for introductions.', href: hiring, login: on ? '/hiring/login' : '/talent/login' },
    { icon: LifeBuoy, title: 'Outplacement', body: 'Give people leaving your company a seat, track the program, and see outcomes in counts.', href: outplacement, login: on ? '/outplacement/login' : '/employer/login' },
    { icon: HeartHandshake, title: 'Retention', body: 'Career paths and internal moves for the people you want to keep.', href: null, login: null },
    { icon: GraduationCap, title: 'Learning and development', body: 'Skills plans and courses tied to the roles your people are growing into.', href: null, login: null },
  ]
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">NextChapter for organizations</h1>
        <p className="text-muted-foreground">Hiring, outplacement, retention and learning, with one partner.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.title} className="space-y-2 rounded-lg border border-border bg-card p-5">
            <t.icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.body}</p>
            {t.href ? (
              <div className="flex gap-3 text-sm">
                <Link href={t.href} className="font-medium text-primary hover:underline">
                  Open
                </Link>
                <Link href={t.login!} className="text-muted-foreground hover:underline">
                  Log in
                </Link>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">Coming soon. Ask us about it: support@launchyournextchapter.com</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
