import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import { CAREERS_EMAIL } from '@/lib/contact/constants'
import { CAREERS_LOCATION, CAREER_VALUES, GROUP_HEADING, GROUP_ORDER, rolesInGroup } from '@/lib/careers/roles'

// Not for search engines: kept out of results here and disallowed in robots.ts.
export const metadata: Metadata = {
  title: 'Careers at NextChapter',
  robots: { index: false, follow: false },
}

const EYEBROW = 'text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground'
const H2 = 'mt-2 max-w-2xl text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl'

export default function CareersPage() {
  const groups = GROUP_ORDER.map((group) => ({ group, roles: rolesInGroup(group) })).filter((g) => g.roles.length > 0)

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="careers" />

      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <p className={EYEBROW}>Careers</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            Help people through a hard career moment
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            NextChapter helps professionals find their next role after a layoff or a career change, and helps the
            employers, colleges, workforce boards, coaches and recruiters who support them. We are a small team based
            in {CAREERS_LOCATION}. Every role below says whether you would lead a function or work inside one.
          </p>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            To apply, email your resume to{' '}
            <TrackedLink
              href={`mailto:${CAREERS_EMAIL}`}
              event="careers_apply_clicked"
              properties={{ slug: null, kind: null, group: null, destination: 'email', placement: 'intro' }}
              className="font-semibold text-brand underline underline-offset-4 hover:text-navy"
            >
              {CAREERS_EMAIL}
            </TrackedLink>
            . Don’t see your role? Email us anyway and tell us what you would do here.
          </p>
        </section>

        {groups.map(({ group, roles }) => (
          <section key={group} aria-labelledby={`group-${group}`} className="border-t border-border bg-off-white">
            <div className="mx-auto max-w-6xl px-6 py-14">
              <h2 id={`group-${group}`} className={H2}>{GROUP_HEADING[group].title}</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{GROUP_HEADING[group].blurb}</p>
              <ul className="mt-8 grid gap-4 md:grid-cols-2">
                {roles.map((role) => (
                  <li key={role.slug} className="flex flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-border">
                    <div className="flex items-center gap-3">
                      <RoleBadge kind={role.kind} />
                      <span className="text-xs text-muted-foreground">{role.employment === 'Platform' ? 'Join the platform' : role.employment}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-navy">{role.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{role.summary}</p>
                    <TrackedLink
                      href={`/careers/${role.slug}`}
                      event="careers_role_clicked"
                      properties={{ slug: role.slug, kind: role.kind, group: role.group }}
                      ariaLabel={`View the ${role.title} role`}
                      className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-4 hover:text-navy"
                    >
                      View role
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <section aria-labelledby="values" className="mx-auto max-w-6xl px-6 py-16">
          <h2 id="values" className={H2}>What we look for</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">The same qualities matter in every role.</p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAREER_VALUES.map((v) => (
              <div key={v.title}>
                <dt className="font-semibold text-navy">{v.title}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{v.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
