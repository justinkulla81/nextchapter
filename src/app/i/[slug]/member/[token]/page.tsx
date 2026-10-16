import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrgUser } from '@/lib/supabase/get-current-user'
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
  const [invite, user] = await Promise.all([memberInvite(slug, token), getOrgUser()])
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
            <h1 className="text-2xl font-semibold tracking-tight">{invite.name} in {brand}</h1>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>When you have a layoff, ask {inst.name} for free career-support seats and get a sign-up page for your people.</li>
              <li>See how your people are doing: how many joined, are interviewing and landed, and how many stayed local. Counts only.</li>
              <li>When you&apos;re hiring, see verified profiles people chose to share and ask for an introduction. They say yes or no.</li>
            </ul>
            {user ? (
              <AcceptMemberInvite slug={slug} token={token} email={user.email ?? ''} />
            ) : (
              <p className="text-sm">
                <Link href={`/i/login?next=${encodeURIComponent(`/i/${slug}/member/${token}`)}`} className="font-medium text-primary hover:underline">
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
