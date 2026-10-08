import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { REFERRER_KINDS, REFERRER_KIND_LABELS } from '@/lib/candidates/referral'
import { createReferralLink, setReferralLinkActive } from '@/app/support/admin/(portal)/crm/people/[id]/referral-actions'

// Who this person has recommended to NextChapter, and their referral links.
export async function CrmReferrals({ personId }: { personId: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  const [referred, links] = await Promise.all([
    prisma.candidateReferral.findMany({
      where: { referrerCrmPersonId: personId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, channel: true, candidate: { select: { id: true, firstName: true, lastName: true, registrationCompletedAt: true } } },
    }),
    prisma.referralLink.findMany({ where: { ownerCrmPersonId: personId }, orderBy: { createdAt: 'desc' } }),
  ])
  const signedUp = referred.filter((r) => r.candidate.registrationCompletedAt).length

  return (
    <section className="space-y-3 rounded-lg border p-4 text-sm">
      <h2 className="font-semibold">Referrals</h2>
      <p className="text-muted-foreground">
        Recommended {referred.length} candidate{referred.length === 1 ? '' : 's'} ({signedUp} signed up).
      </p>
      {referred.length > 0 && (
        <ul className="space-y-1">
          {referred.map((r) => (
            <li key={r.id}>
              <Link href={`/support/admin/candidates/${r.candidate.id}`} className="underline">
                {[r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed candidate'}
              </Link>{' '}
              <span className="text-muted-foreground">· {r.createdAt.toLocaleDateString('en-US')}</span>
            </li>
          ))}
        </ul>
      )}
      {links.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{`${appUrl}/api/r/${l.code}`}</code>
          <span className="text-xs text-muted-foreground">{REFERRER_KIND_LABELS[l.kind]} · {l.clickCount} click{l.clickCount === 1 ? '' : 's'}{l.isActive ? '' : ' · off'}</span>
          <form action={setReferralLinkActive.bind(null, personId, l.id, !l.isActive)}>
            <SubmitButton size="sm" variant="ghost" pendingLabel="…">{l.isActive ? 'Turn off' : 'Turn on'}</SubmitButton>
          </form>
        </div>
      ))}
      <form action={createReferralLink.bind(null, personId)} className="flex flex-wrap items-center gap-2">
        <select name="kind" defaultValue="HIGHER_ED" aria-label="Type of recommender" className="h-8 rounded-md border border-input bg-transparent px-2 text-sm">
          {REFERRER_KINDS.map((k) => <option key={k} value={k}>{REFERRER_KIND_LABELS[k]}</option>)}
        </select>
        <SubmitButton size="sm" variant="outline" pendingLabel="Creating…">Create referral link</SubmitButton>
      </form>
    </section>
  )
}
