import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { accentTextOnWhite, readableTextOn } from '@/lib/higher-ed/branding'
import { readProfile } from '@/lib/higher-ed/profile'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { PartnerClaimForm } from '@/components/higher-ed/PartnerClaimForm'
import { isPlausibleInviteToken } from '@/lib/workforce/ecosystem'

// An invitation to join an organization's talent network. Unlisted. Asking to join is only a request: it gives no access.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Join the talent network' } }
export const dynamic = 'force-dynamic'

export default async function PartnerInvitePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  if (!isPlausibleInviteToken(token)) notFound()
  const p = await prisma.ecosystemPartner
    .findUnique({ where: { inviteToken: token }, include: { institution: { select: { slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, profile: true } } } })
    .catch(() => null)
  if (!p || p.institution.slug !== slug) notFound()
  const inst = p.institution
  const accent = inst.accentColor ?? '#1f5f8b'
  const style = { ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent), ['--accent-text' as string]: accentTextOnWhite(accent) }
  const orgName = inst.programBrandName ?? inst.name
  const region = readProfile(inst.profile).region?.name ?? null
  return (
    <div className="min-h-screen bg-background" style={style}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
          <p className="font-semibold">{orgName}</p>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}: join the {region ?? orgName} talent network</h1>
          <p className="text-muted-foreground">
            {orgName} is bringing employers, colleges and training providers together around one picture of the jobs and skills in the region. Tell us who you are and how you would like to take part.
          </p>
        </div>
        {p.status === 'CONFIRMED' ? (
          <p role="status" className="rounded-lg border border-border bg-card p-5 text-sm">
            You are confirmed as part of the network. {orgName} will be in touch.
          </p>
        ) : p.status === 'DECLINED' ? (
          <p role="status" className="rounded-lg border border-border bg-card p-5 text-sm">
            This invitation is no longer open. Ask {orgName} for a new one.
          </p>
        ) : p.status === 'CLAIMED' ? (
          <p role="status" className="rounded-lg border border-border bg-card p-5 text-sm">
            Your request is in. {orgName} reviews it and will be in touch. You can send it again below to change what you offered.
          </p>
        ) : null}
        {p.status !== 'CONFIRMED' && p.status !== 'DECLINED' && <PartnerClaimForm slug={slug} token={token} />}
        <p className="text-xs text-muted-foreground">
          This does not publish anything and does not give anyone access to your systems. {orgName} sees only what you type here.
        </p>
      </main>
    </div>
  )
}
