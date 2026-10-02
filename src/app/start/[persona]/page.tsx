import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PersonaOnboardingCta } from '@/components/start/PersonaOnboardingCta'
import { PERSONAS, getPersona } from '@/lib/constants/personas'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>
}): Promise<Metadata> {
  const { persona: slug } = await params
  const persona = getPersona(slug)
  if (!persona) return {}
  return {
    title: `${persona.headline} — NextChapter`,
    description: persona.hook,
    alternates: { canonical: `/start/${persona.slug}` },
  }
}

export default async function PersonaPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona: slug } = await params
  const persona = getPersona(slug)
  if (!persona) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />

      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm font-semibold tracking-widest text-brand uppercase">{persona.label}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{persona.headline}</h1>
        <div className="mx-auto mt-6 max-w-xl space-y-4 text-left text-muted-foreground">
          {persona.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8">
          <PersonaOnboardingCta persona={persona.slug} situation={persona.situation} />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        <p className="text-center text-sm text-muted-foreground">Not quite you?</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {PERSONAS.filter((p) => p.slug !== persona.slug).map((p) => (
            <Link
              key={p.slug}
              href={`/start/${p.slug}`}
              className="rounded-full border border-light-gray px-4 py-1.5 text-sm text-foreground hover:border-brand/40"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
