import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import { CAREERS_LOCATION, CAREER_VALUES, GROUP_HEADING, GROUP_ORDER, rolesInGroup } from '@/lib/careers/roles'

// Not for search engines: kept out of results here and disallowed in robots.ts.
export const metadata: Metadata = {
  title: 'Careers at NextChapter',
  robots: { index: false, follow: false },
}

const H2 = 'text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl'

export default function CareersPage() {
  const groups = GROUP_ORDER.map((group) => ({ group, roles: rolesInGroup(group) })).filter((g) => g.roles.length > 0)

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="careers" />

      <main>
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">Careers at NextChapter</h1>
          <p className="mt-3 text-muted-foreground">
            We help professionals through a layoff or career change, and the organizations that support them. A small
            team based in {CAREERS_LOCATION}. To apply,{' '}
            <TrackedLink
              href="/careers/apply"
              event="careers_apply_clicked"
              properties={{ slug: null, kind: null, group: null, destination: 'apply_form', placement: 'intro' }}
              className="font-semibold text-brand underline underline-offset-4 hover:text-navy"
            >
              upload your resume
            </TrackedLink>
            . Don’t see your role? Apply anyway.
          </p>
        </section>

        <section aria-label="Open roles" className="mx-auto max-w-3xl px-6 pb-12 pt-4">
          {groups.map(({ group, roles }) => (
            <div key={group} className="mt-8 first:mt-0">
              <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{GROUP_HEADING[group]}</h2>
              <ul className="mt-3 flex flex-col gap-4">
                {roles.map((role) => (
                  <li key={role.slug} className="relative flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <TrackedLink
                        href={`/careers/${role.slug}`}
                        event="careers_role_clicked"
                        properties={{ slug: role.slug, kind: role.kind, group: role.group }}
                        className="text-lg font-semibold text-brand underline-offset-4 after:absolute after:inset-0 hover:text-navy hover:underline"
                      >
                        {role.title}
                      </TrackedLink>
                      <p className="mt-0.5 text-sm text-muted-foreground">{role.summary}</p>
                    </div>
                    <div className="shrink-0">
                      <RoleBadge kind={role.kind} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="values" className="border-t border-border bg-off-white">
          <div className="mx-auto max-w-3xl px-6 py-12">
            <h2 id="values" className={H2}>What we look for</h2>
            <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {CAREER_VALUES.map((v) => (
                <div key={v.title}>
                  <dt className="font-semibold text-navy">{v.title}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{v.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
