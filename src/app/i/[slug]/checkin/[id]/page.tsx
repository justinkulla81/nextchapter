import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { CHECKIN_ANSWERS, findCheckInForAnswer, isCheckInAnswer } from '@/lib/higher-ed/checkins'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { CheckInAnswerForm } from '@/components/higher-ed/CheckInAnswerForm'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Landing from a college check-in email. The answer clicked in the email is
// preselected; nothing is recorded until "Send my answer".
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ t?: string; a?: string }>
}) {
  const { slug, id } = await params
  const { t, a } = await searchParams
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const c = t ? await findCheckInForAnswer(slug, id, t) : null
  const accent = inst.accentColor ?? '#2e7d5b'
  const joined = !!c?.member.candidateId && (c.member.status === 'CLAIMED' || c.member.status === 'ACTIVE')

  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.programBrandName ?? inst.name}</p>
        </div>
        {c ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{c.member.firstName ? `${c.member.firstName}, has anything changed?` : 'Has anything changed?'}</h1>
            <CheckInAnswerForm
              slug={slug}
              checkInId={id}
              token={t!}
              answers={CHECKIN_ANSWERS}
              initial={isCheckInAnswer(a) ? a : null}
              college={inst.name}
              joined={joined}
            />
            <p className="text-xs text-muted-foreground">Only {inst.name} sees your answer.</p>
          </>
        ) : (
          <p className="text-sm">This check-in link isn&apos;t valid any more. Your alumni office can send a new one.</p>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
