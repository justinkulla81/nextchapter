import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrgUser } from '@/lib/supabase/get-current-user'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { accessInvite } from '@/lib/workforce/partner-access'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { AcceptPartnerAccess } from '@/components/higher-ed/AcceptPartnerAccess'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

// A confirmed partner's one-time sign-in link from the organization's steward. Shows only the partner's name and the organization.
export default async function PartnerAccessPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { name: true, programBrandName: true, logoUrl: true, accentColor: true } })
  if (!inst) notFound()
  const [invite, user] = await Promise.all([accessInvite(slug, token), getOrgUser()])
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
            <h1 className="text-2xl font-semibold tracking-tight">
              {invite.partner.name} in {brand}’s talent network
            </h1>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>See what you offered, and update it.</li>
              <li>Open anything {brand} shared with you.</li>
              <li>It shows nothing about individual job seekers.</li>
            </ul>
            {user ? (
              <AcceptPartnerAccess slug={slug} token={token} email={user.email ?? ''} />
            ) : (
              <p className="text-sm">
                <Link href={`/i/login?next=${encodeURIComponent(`/i/${slug}/partner-account/${token}`)}`} className="font-medium text-primary hover:underline">
                  Sign in with {invite.email}
                </Link>{' '}
                to accept.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">This link has been used or replaced</h1>
            <p className="text-sm text-muted-foreground">If you already accepted, sign in to {brand} to open your partner page. Otherwise ask the person who sent it for a new link.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">powered by NextChapter</p>
      </main>
    </div>
  )
}
