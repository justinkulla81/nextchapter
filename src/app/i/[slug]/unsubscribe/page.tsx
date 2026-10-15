import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { memberForToken } from '@/lib/higher-ed/email-events'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { UnsubscribeForm } from '@/components/higher-ed/UnsubscribeForm'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params
  const { t } = await searchParams
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const m = t ? await memberForToken(t) : null
  const valid = m && m.institution.slug === slug
  const accent = inst.accentColor ?? '#2e7d5b'
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.programBrandName ?? inst.name}</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Email from {inst.name}</h1>
        {valid ? (
          <UnsubscribeForm
            slug={slug}
            token={t!}
            college={inst.name}
            initiallyOn={!m.emailSuppressedAt}
            canUndo={m.emailSuppressedReason === 'UNSUBSCRIBED'}
          />
        ) : (
          <p className="text-sm">This link isn&apos;t valid any more. Reply to any email from your alumni office and they&apos;ll take you off the list.</p>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
