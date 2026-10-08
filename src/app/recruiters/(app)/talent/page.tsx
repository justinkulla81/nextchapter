import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAssign, getTalentContext, visibleConnectionsWhere } from '@/lib/recruiter/intake/access'
import { TALENT_PRODUCT_NAME } from '@/lib/recruiter/intake/constants'
import { TalentSubnav, TagBadge } from '@/components/recruiter/talent/TalentSubnav'
import { TalentActionForm } from '@/components/recruiter/talent/TalentForms'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTalentFirm } from './actions'

const SOURCE_LABEL = { PAGE: 'Inbound page', NOT_FIT_LINK: '"Not a fit now" link', FORWARD: 'Forwarded email' } as const

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'general', label: 'General hopper' },
  { key: 'fit', label: 'Fit' },
  { key: 'niche', label: 'In your niche' },
  { key: 'outside', label: 'Outside focus' },
] as const

export default async function TalentHopperPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await getTalentContext()
  const { view = 'all' } = await searchParams

  if (!ctx.firm) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Answer every candidate you can&apos;t place</h1>
          <p className="mt-2 text-muted-foreground">
            Candidates you can&apos;t help get a reply in your name and free support from NextChapter. You get the
            fits flagged right away, and you hear when the rest land.
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold">Set up your firm</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Independent? Use your own name. If your firm is already on NextChapter, ask its admin to invite you instead.
          </p>
          <TalentActionForm action={createTalentFirm} submitLabel="Create my firm" pendingLabel="Creating…">
            <div className="space-y-2">
              <Label htmlFor="name">Firm name</Label>
              <Input id="name" name="name" defaultValue={ctx.recruiter.firmName ?? ''} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Page address</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>launchyournextchapter.com/in/</span>
                <Input id="slug" name="slug" placeholder="summit" className="max-w-40" />
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to use your firm name.</p>
            </div>
          </TalentActionForm>
        </div>
      </div>
    )
  }

  const visible = visibleConnectionsWhere(ctx)
  const filter: Prisma.IntakeConnectionWhereInput =
    view === 'mine'
      ? { recruiterId: ctx.recruiter.id }
      : view === 'general'
        ? { recruiterId: null }
        : view === 'fit'
          ? { tag: 'FIT' }
          : view === 'niche'
            ? { tag: 'NICHE' }
            : view === 'outside'
              ? { tag: 'OUTSIDE' }
              : {}

  const [connections, draftCount, recruiters] = await Promise.all([
    prisma.intakeConnection.findMany({
      where: { AND: [visible, filter] },
      include: {
        intakeCandidate: { select: { fullName: true, location: true } },
        search: { select: { title: true } },
        replies: { where: { status: { in: ['DRAFT', 'APPROVED', 'SENT'] } }, select: { status: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.intakeReply.count({ where: { status: 'DRAFT', connection: visible } }),
    prisma.recruiter.findMany({ where: { recruiterFirmId: ctx.firm.id, firmRole: { not: null } }, select: { id: true, fullName: true } }),
  ])
  const nameOf = new Map(recruiters.map((r) => [r.id, r.fullName]))
  const showGeneral = canAssign(ctx)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME} · {ctx.firm.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
      </div>
      <TalentSubnav active="/recruiters/talent" draftCount={draftCount} />

      {ctx.role === 'ADMIN' && !ctx.firm.onboardingCompletedAt && (
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-medium">Finish setting up {ctx.firm.name}</p>
          <p className="text-muted-foreground">
            Add your logo, colors and website button, and connect your tools.{' '}
            <Link href="/recruiters/talent/onboarding" className="font-medium text-brand underline underline-offset-4">Continue setup</Link>
          </p>
        </div>
      )}

      {ctx.firm.status !== 'VERIFIED' && (
        <div className="rounded-lg border border-orange/40 bg-orange/5 p-4 text-sm">
          <p className="font-medium">Your firm is waiting for NextChapter to verify it.</p>
          <p className="text-muted-foreground">
            Finish <Link href="/recruiters/talent/setup" className="underline">setup</Link> now; your Inbound pages
            and forwarding addresses go live once verification is done, usually within one business day.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter candidates">
        {FILTERS.filter((f) => f.key !== 'general' || showGeneral).map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/recruiters/talent' : `/recruiters/talent?view=${f.key}`}
            aria-current={view === f.key ? 'true' : undefined}
            className={
              view === f.key
                ? 'rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground'
                : 'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground'
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="font-medium">No candidates here yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Put your Inbound page on your website and in your rejection email, or forward a resume to your address.
            Both are on the <Link href="/recruiters/talent/setup" className="underline">Setup</Link> tab.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Tag</th>
                <th className="px-4 py-2 font-medium">Why</th>
                <th className="px-4 py-2 font-medium">Recruiter</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Reply</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => {
                const replyStatus = c.replies.find((r) => r.status === 'SENT')
                  ? 'Sent'
                  : c.replies.find((r) => r.status === 'APPROVED')
                    ? 'Approved'
                    : c.replies.find((r) => r.status === 'DRAFT')
                      ? 'Needs your OK'
                      : '—'
                return (
                  <tr key={c.id} className="border-t border-border align-top hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/recruiters/talent/${c.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                        {c.intakeCandidate.fullName}
                      </Link>
                      {c.intakeCandidate.location && <p className="text-xs text-muted-foreground">{c.intakeCandidate.location}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <TagBadge tag={c.tag} />
                      {c.search && <p className="mt-1 text-xs text-muted-foreground">{c.search.title}</p>}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-xs text-muted-foreground">{c.tagReasons[0] ?? ''}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.recruiterId ? (
                        nameOf.get(c.recruiterId)
                      ) : c.suggestedRecruiterId ? (
                        <span className="text-muted-foreground">Suggested: {nameOf.get(c.suggestedRecruiterId)}</span>
                      ) : (
                        <span className="text-muted-foreground">General hopper</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{SOURCE_LABEL[c.source]}</td>
                    <td className="px-4 py-3 text-xs">{replyStatus}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.updatedAt.toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
