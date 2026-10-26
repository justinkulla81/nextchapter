import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { RoleBadge } from '@/components/careers/RoleBadge'
import { StructuredData } from '@/components/StructuredData'
import { careerJobPostingJsonLd } from '@/lib/careers/job-posting-jsonld'
import { CAREERS_LOCATION, CAREER_ROLES, KIND_EXPLAINER, getRole } from '@/lib/careers/roles'

export function generateStaticParams() {
  return CAREER_ROLES.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const role = getRole(slug)
  if (!role) return {}
  return {
    title: `${role.title}: careers at NextChapter`,
    description: role.summary,
    alternates: { canonical: `/careers/${role.slug}` },
    openGraph: { title: `${role.title}: careers at NextChapter`, description: role.summary, url: `/careers/${role.slug}`, type: 'website' },
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
  if (!role) notFound()

  const isPlatform = role.kind === 'platform'
  const jobPosting = careerJobPostingJsonLd(role)
  const applyHref = `/careers/apply?role=${encodeURIComponent(role.slug)}`
  const primary = 'inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover'

  return (
    <div className="flex flex-1 flex-col bg-white">
      {jobPosting && <StructuredData data={jobPosting} />}
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
                properties={{ slug: role.slug, kind: role.kind, group: role.group, destination: 'apply_form', placement: 'role_page' }}
                className={primary}
              >
                Apply with your resume
              </TrackedLink>
            </>
          )}
        </div>

        <section className="mt-10">
          <h2 className={H2}>About the role</h2>
          <p className="mt-3 text-muted-foreground">{role.about}</p>
          <p className="mt-3 text-muted-foreground"><span className="font-semibold text-navy">Seniority:</span> {role.seniority}</p>
        </section>
        {role.focus && <Section title="Who you work with" items={role.focus} />}
        <Section title={isPlatform ? 'How it works' : 'What you will do'} items={role.responsibilities} />
        <Section title={isPlatform ? 'What we look for' : 'Required qualifications'} items={role.required} />
        {role.preferred.length > 0 && <Section title="Preferred qualifications" items={role.preferred} />}
        {role.skills.length > 0 && (
          <section className="mt-10">
            <h2 className={H2}>Skills and tools</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {role.skills.map((s) => (
                <li key={s} className="rounded-full border border-border px-3 py-1 text-sm text-navy">{s}</li>
              ))}
            </ul>
          </section>
        )}
        {role.knowledge.length > 0 && <Section title="What you need to know" items={role.knowledge} />}
        {role.howYouWork.length > 0 && <Section title="How you work" items={role.howYouWork} />}
        {role.firstNinetyDays && <Section title="In your first 90 days" items={role.firstNinetyDays} />}
      </main>

      <PublicSiteFooter page="careers" />
    </div>
  )
}
