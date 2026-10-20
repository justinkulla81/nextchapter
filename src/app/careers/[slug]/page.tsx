import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import {
  CAREERS_LOCATION, CAREER_ROLES, EEO_STATEMENT, KIND_EXPLAINER, careersPageLive, getRole,
} from '@/lib/careers/roles'

export function generateStaticParams() {
  return CAREER_ROLES.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const role = getRole(slug)
  if (!role || !careersPageLive()) return {}
  const title = `${role.title}: careers at NextChapter`
  return {
    title,
    description: role.summary,
    alternates: { canonical: `/careers/${role.slug}` },
    openGraph: { title, description: role.summary, url: `https://launchyournextchapter.com/careers/${role.slug}` },
  }
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
  if (!role || !careersPageLive()) notFound()

  const isPlatform = role.kind === 'platform'
  const applyHref = `/contact?as=careers&role=${encodeURIComponent(role.title)}`

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
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
            >
              {role.slug === 'coach' ? 'Learn about the coach platform' : 'Learn about the recruiter portal'}
            </TrackedLink>
          ) : (
            <TrackedLink
              href={applyHref}
              event="careers_apply_clicked"
              properties={{ slug: role.slug, kind: role.kind, group: role.group, destination: 'contact_form' }}
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
            >
              Apply for this role
            </TrackedLink>
          )}
          {!isPlatform && (
            <p className="mt-3 text-sm text-muted-foreground">You will add your LinkedIn profile and a note on why NextChapter.</p>
          )}
        </div>

        {role.compensation && (
          <section className="mt-10">
            <h2 className={H2}>Pay</h2>
            <p className="mt-3 text-muted-foreground">{role.compensation}</p>
          </section>
        )}

        {role.focus && <Section title="Who you work with" items={role.focus} />}
        <Section title={isPlatform ? 'How it works' : 'What you will do'} items={role.responsibilities} />
        <Section title="What you bring" items={role.bring} />
        {role.bonus && <Section title="A plus" items={role.bonus} />}
        {role.firstNinetyDays && <Section title="In your first 90 days" items={role.firstNinetyDays} />}

        {!isPlatform && <p className="mt-12 text-sm text-muted-foreground">{EEO_STATEMENT}</p>}
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
