import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { publicRapidResponse } from '@/lib/higher-ed/rapid-response'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { RapidSignUpForm } from '@/components/higher-ed/RapidSignUpForm'
import { SeatSignUpForm } from '@/components/higher-ed/SeatSignUpForm'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))

// The public page for one rapid-response offer, shared with affected workers.
export default async function RapidPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true, orgType: true } })
  if (!inst) notFound()
  const r = await publicRapidResponse(slug, id)
  const accent = inst.accentColor ?? '#2e7d5b'
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.orgType === 'COLLEGE' ? `${inst.name} and your local workforce board` : (inst.programBrandName ?? inst.name)}</p>
        </div>
        {r ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
            <p className="whitespace-pre-line text-muted-foreground">{r.message}</p>
            {r.seats ? (
              r._count.participants < r.seats ? (
                <SeatSignUpForm slug={slug} id={id} orgName={inst.programBrandName ?? inst.name} />
              ) : (
                <p className="text-sm">All the seats for this offer are taken. Contact your local career center for other options.</p>
              )
            ) : r.cohorts.length ? (
              <RapidSignUpForm
                slug={slug}
                id={id}
                cohorts={r.cohorts.map((c) => ({ id: c.id, label: `${c.program.name} · ${c.name} · starts ${day(c.startsAt)}${c.program.wioaEligible ? ' · WIOA-eligible' : ''}` }))}
              />
            ) : (
              <p className="text-sm">The programs in this offer are full right now. Contact your local American Job Center for other options.</p>
            )}
          </>
        ) : (
          <p className="text-sm">Sign-ups for this offer have closed. Contact your local American Job Center for other options.</p>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
