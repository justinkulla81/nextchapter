import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import {
  CAREERS_LOCATION, CAREER_VALUES, EEO_STATEMENT, GROUP_HEADING, GROUP_ORDER, HIRING_STEPS,
  careersPageLive, rolesInGroup,
} from '@/lib/careers/roles'

const DESCRIPTION =
  'Work on NextChapter. Lead roles, contributor roles, an internship and a new graduate associate program, plus how coaches and recruiters can join the platform.'

export const metadata: Metadata = {
  title: 'Careers at NextChapter',
  description: DESCRIPTION,
  alternates: { canonical: '/careers' },
  openGraph: { title: 'Careers at NextChapter', description: DESCRIPTION, url: 'https://launchyournextchapter.com/careers' },
}

const EYEBROW = 'text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground'
const H2 = 'mt-2 max-w-2xl text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl'

export default function CareersPage() {
  if (!careersPageLive()) notFound()

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
            employers, colleges, workforce boards, coaches and recruiters who support them. We are a small team in{' '}
            {CAREERS_LOCATION}. Every role below says whether you would lead a function or work inside one.
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

        <section aria-labelledby="how-we-hire" className="border-t border-border bg-off-white">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 id="how-we-hire" className={H2}>How we hire</h2>
            <ul className="mt-6 max-w-2xl list-disc space-y-2 pl-5 text-muted-foreground">
              {HIRING_STEPS.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <p className="mt-8 max-w-2xl text-sm text-muted-foreground">{EEO_STATEMENT}</p>
          </div>
        </section>
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
