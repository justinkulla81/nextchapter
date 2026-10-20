import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import { CAREERS_EMAIL } from '@/lib/contact/constants'
import { CAREERS_LOCATION, CAREER_ROLES, KIND_EXPLAINER, getRole } from '@/lib/careers/roles'

export function generateStaticParams() {
  return CAREER_ROLES.map((r) => ({ slug: r.slug }))
}

// Not for search engines: kept out of results here and disallowed in robots.ts.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const role = getRole(slug)
  if (!role) return {}
  return { title: `${role.title}: careers at NextChapter`, robots: { index: false, follow: false } }
}

const H2 = 'text-xl font-semibold text-navy'

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-10">
      <h2 className={H2}>{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </section>
  )
}

export default async function CareerRolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const role = getRole(slug)
  if (!role) notFound()

  const isPlatform = role.kind === 'platform'
  const applyHref = `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(`Application: ${role.title}`)}`
  const primary = 'inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover'

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="careers" />

      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <Link href="/careers" className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-navy">
          All roles
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <RoleBadge kind={role.kind} />
          <span className="text-sm text-muted-foreground">
            {isPlatform ? 'Join the platform' : `${role.employment} · ${CAREERS_LOCATION}`}
          </span>
        </div>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-navy">{role.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{KIND_EXPLAINER[role.kind]}</p>
        <p className="mt-5 text-lg text-muted-foreground">{role.summary}</p>

        <div className="mt-8">
          {isPlatform && role.externalHref ? (
            <TrackedLink
              href={role.externalHref}
              event="careers_apply_clicked"
              properties={{ slug: role.slug, kind: role.kind, group: role.group, destination: role.externalHref }}
              className={primary}
            >
              {role.slug === 'coach' ? 'Learn about the coach platform' : 'Learn about the recruiter portal'}
            </TrackedLink>
          ) : (
            <>
              <TrackedLink
                href={applyHref}
                event="careers_apply_clicked"
                properties={{ slug: role.slug, kind: role.kind, group: role.group, destination: 'email', placement: 'role_page' }}
                className={primary}
              >
                Email your resume
              </TrackedLink>
              <p className="mt-3 text-sm text-muted-foreground">Send your resume to {CAREERS_EMAIL}.</p>
            </>
          )}
        </div>

        {role.focus && <Section title="Who you work with" items={role.focus} />}
        <Section title={isPlatform ? 'How it works' : 'What you will do'} items={role.responsibilities} />
        <Section title="What you bring" items={role.bring} />
        {role.bonus && <Section title="A plus" items={role.bonus} />}
        {role.firstNinetyDays && <Section title="In your first 90 days" items={role.firstNinetyDays} />}
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
