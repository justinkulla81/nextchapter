import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { memberInvite } from '@/lib/workforce/member-access'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { AcceptMemberInvite } from '@/components/higher-ed/AcceptMemberInvite'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// A hiring member company's one-time invite from a workforce org.
export default async function MemberInvitePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const [invite, user] = await Promise.all([memberInvite(slug, token), getCurrentUser()])
  const accent = inst.accentColor ?? '#2e7d5b'
  const brand = inst.programBrandName ?? inst.name
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent) }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{brand}</p>
        </div>
        {invite ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{invite.name}: meet local job seekers</h1>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>See verified profiles of people in {inst.name}&apos;s program who chose to share them with hiring member companies.</li>
              <li>Ask for an introduction. Each person says yes or no, and you get their email only on a yes.</li>
            </ul>
            {user ? (
              <AcceptMemberInvite slug={slug} token={token} email={user.email ?? ''} />
            ) : (
              <p className="text-sm">
                <Link href={`/auth/login?next=${encodeURIComponent(`/i/${slug}/member/${token}`)}`} className="font-medium text-primary hover:underline">
                  Sign in with {invite.invitedEmail ?? 'the email this went to'}
                </Link>{' '}
                to accept.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">This invite has been used or replaced</h1>
            <p className="text-sm text-muted-foreground">If you already accepted, open your access at <Link href={`/i/${slug}/employer`} className="text-primary hover:underline">/i/{slug}/employer</Link>. Otherwise ask {inst.name} for a new invite.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
