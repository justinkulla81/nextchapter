import type { Metadata } from 'next'
import Link from 'next/link'
import { Briefcase, GraduationCap, LifeBuoy, Sprout } from 'lucide-react'
import { NOINDEX } from '@/lib/seo/canonical'
import { portalHostOn } from '@/lib/portal-hosts'

export const metadata: Metadata = { ...NOINDEX, title: 'NextChapter for organizations' }

// The organization portal's front door (organization.<site>): one place for
// an employer's work with NextChapter. Outplacement, Growth and Learning
// share one employer account (/employer); Hiring has its own (/talent).
export default function OrganizationHome() {
  const on = portalHostOn('organization')
  const hiring = on ? '/hiring' : '/talent/dashboard'
  const outplacement = on ? '/outplacement' : '/employer'
  const employerLogin = on ? '/outplacement/login' : '/employer/login'
  const tiles = [
    { icon: Briefcase, title: 'Hiring', body: 'Post roles, see matched candidates who chose to be seen, and ask for introductions.', href: hiring, login: on ? '/hiring/login' : '/talent/login' },
    { icon: LifeBuoy, title: 'Outplacement', body: 'Give people leaving your company a seat, track the program, and see outcomes in counts.', href: outplacement, login: employerLogin },
    { icon: Sprout, title: 'Growth', body: 'Keep your people: promotion and raise prep, internal roles only they see, and paths into new functions.', href: on ? '/growth' : '/employer/growth', login: employerLogin },
    { icon: GraduationCap, title: 'Learning', body: 'A skills plan for each person’s role and next role, with the courses you cover first.', href: on ? '/learning' : '/employer/learning', login: employerLogin },
  ]
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">NextChapter for organizations</h1>
        <p className="text-muted-foreground">Hiring, outplacement, growth and learning, with one partner.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.title} className="space-y-2 rounded-lg border border-border bg-card p-5">
            <t.icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.body}</p>
            <div className="flex gap-3 text-sm">
              <Link href={t.href} className="font-medium text-primary hover:underline">
                Open {t.title}
              </Link>
              <Link href={t.login} className="text-muted-foreground hover:underline">
                Log in
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
