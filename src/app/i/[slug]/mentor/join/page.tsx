import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { findMemberByToken } from '@/lib/higher-ed/join'
import { MENTOR_INDUSTRIES } from '@/lib/higher-ed/mentor-network'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { MentorJoin } from '@/components/higher-ed/MentorEmailForms'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// "Would you take a call?" from Alumni Relations' mentor invitation. No
// account needed to say yes; requests arrive by email.
export default async function MentorJoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params
  const { t } = await searchParams
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const m = t ? await findMemberByToken(slug, t) : null
  const accent = inst.accentColor ?? '#2e7d5b'
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{inst.programBrandName ?? inst.name}</p>
        </div>
        {m ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{m.firstName ? `Thank you, ${m.firstName}` : 'Thank you'}</h1>
            <p className="text-muted-foreground">
              Fellow {inst.name} alumni will be able to ask you for a 20-minute call. You accept or decline each request, and your email is shared only
              when you accept.
            </p>
            <MentorJoin slug={slug} token={t!} industries={MENTOR_INDUSTRIES} />
          </>
        ) : (
          <p className="text-sm">This link isn&apos;t valid any more. Your alumni office can send a new one.</p>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
