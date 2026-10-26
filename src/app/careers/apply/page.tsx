import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { ApplyForm } from '@/components/careers/ApplyForm'
import { APPLY_ROLES } from '@/lib/careers/application'

// The roles are indexed; the form behind them is not.
export const metadata: Metadata = {
  title: 'Apply: careers at NextChapter',
  robots: { index: false, follow: false },
}

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader current="careers" />
      <main className="mx-auto w-full max-w-xl px-6 py-10">
        <Link href="/careers" className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-navy">
          All roles
        </Link>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-navy">Apply with your resume</h1>
        <p className="mt-2 text-muted-foreground">Choose the role and upload your resume. That is all we need to start.</p>
        <div className="mt-8">
          <ApplyForm roles={APPLY_ROLES.map((r) => ({ slug: r.slug, title: r.title }))} initialRole={role} />
        </div>
      </main>
      <PublicSiteFooter page="careers" />
    </div>
  )
}
