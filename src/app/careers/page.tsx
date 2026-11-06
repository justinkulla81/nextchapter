import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import { CAREERS_LOCATION, CAREER_VALUES, GROUP_HEADING, GROUP_ORDER, rolesInGroup } from '@/lib/careers/roles'
import { Squiggle } from '@/components/ui/squiggle'

export const metadata: Metadata = {
  title: 'Careers at NextChapter',
  description:
    'Open roles at NextChapter, a small team in New York City or remote helping professionals through layoffs and career change. Leads in editorial, sales, partnerships, product, technology and marketing, plus an internship and a new graduate program. AI skills expected; no experience needed for early-career roles.',
  alternates: { canonical: '/careers' },
}

const H2 = 'text-balance text-2xl font-bold tracking-tight text-navy sm:text-3xl'

export default function CareersPage() {
  const groups = GROUP_ORDER.map((group) => ({ group, roles: rolesInGroup(group) })).filter((g) => g.roles.length > 0)

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="careers" />

      <main>
        <section className="border-b border-border bg-off-white">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Careers</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight text-navy sm:text-5xl">
              Help people through the hardest week of their career
            </h1>
            <Squiggle className="mt-2" />
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              NextChapter helps professionals through a layoff or career change, and the organizations that support them.
              We are a small team where every person owns real work.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <TrackedLink
                href="/careers/apply"
                event="careers_apply_clicked"
                properties={{ slug: null, kind: null, group: null, destination: 'apply_form', placement: 'intro' }}
                className="inline-flex items-center rounded-lg bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand"
              >
                Upload your resume
              </TrackedLink>
              <a href="#open-roles" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
                See open roles ↓
              </a>
            </div>
            <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Location</dt>
                <dd className="mt-1 font-semibold text-navy">{CAREERS_LOCATION}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Open roles</dt>
                <dd className="mt-1 font-semibold text-navy">{groups.reduce((n, g) => n + g.roles.filter((r) => r.kind !== 'platform').length, 0)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Early career</dt>
                <dd className="mt-1 font-semibold text-navy">No experience needed</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="open-roles" aria-labelledby="roles-heading" className="mx-auto max-w-5xl scroll-mt-6 px-6 py-14">
          <h2 id="roles-heading" className={H2}>Open roles</h2>
          <p className="mt-2 text-muted-foreground">Don’t see your role? Apply anyway.</p>
          {groups.map(({ group, roles }) => (
            <div key={group} className="mt-10">
              <h3 className="border-b border-border pb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {GROUP_HEADING[group]}
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {roles.map((role) => (
                  <li
                    key={role.slug}
                    className="group relative flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition hover:border-navy hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <TrackedLink
                        href={`/careers/${role.slug}`}
                        event="careers_role_clicked"
                        properties={{ slug: role.slug, kind: role.kind, group: role.group }}
                        className="text-lg font-semibold text-navy after:absolute after:inset-0 group-hover:text-brand"
                      >
                        {role.title}
                      </TrackedLink>
                      <div className="shrink-0">
                        <RoleBadge kind={role.kind} />
                      </div>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{role.summary}</p>
                    <span aria-hidden className="mt-4 text-sm font-semibold text-brand">View role →</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="values" className="border-t border-border bg-off-white">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 id="values" className={H2}>What we look for</h2>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CAREER_VALUES.map((v) => (
                <div key={v.title} className="rounded-xl border border-border bg-white p-5">
                  <dt className="font-semibold text-navy">{v.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-navy">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Ready to join us?</h2>
              <p className="mt-1 text-white/80">Upload your resume and tell us where you would fit.</p>
            </div>
            <TrackedLink
              href="/careers/apply"
              event="careers_apply_clicked"
              properties={{ slug: null, kind: null, group: null, destination: 'apply_form', placement: 'footer' }}
              className="inline-flex shrink-0 items-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-navy hover:bg-off-white"
            >
              Apply now
            </TrackedLink>
          </div>
        </section>
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
