import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { CopyButton } from '@/components/ui/copy-button'
import { loadFirmRows, type FirmFilter } from '@/lib/search-firms/report'
import { SEGMENT_LABEL } from '@/lib/search-firms/match'
import { PITCH_DRAFTS, SUBMIT_SEARCH_PATH, wordCount } from '@/lib/search-firms/pitches'
import { SearchFirmReviewRow } from '@/components/search-firms/SearchFirmReviewRow'
import { setSearchRequestStatus } from './actions'

export const maxDuration = 60

const FILTERS: { value: FirmFilter; label: string }[] = [
  { value: 'live', label: 'With live searches' },
  { value: 'all', label: 'All firms' },
  { value: 'review', label: 'Needs review' },
  { value: 'no_contacts', label: 'No contacts yet' },
]
const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  NEW: [{ status: 'SHORTLISTING', label: 'Start shortlist' }, { status: 'CLOSED', label: 'Close' }],
  SHORTLISTING: [{ status: 'SENT', label: 'Mark shortlist sent' }, { status: 'CLOSED', label: 'Close' }],
  SENT: [{ status: 'CLOSED', label: 'Close' }],
  CLOSED: [{ status: 'NEW', label: 'Reopen' }],
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
}

/**
 * Search-firm outreach: which firms have live searches, who to write to at
 * each, the draft pitches, and the searches recruiters have sent in.
 * Nothing on this page sends anything — every message is copied out and
 * sent by hand after Justin approves it.
 */
export default async function SearchFirmsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const filter = (FILTERS.find((f) => f.value === sp.filter)?.value ?? 'live') as FirmFilter
  const q = (sp.q ?? '').trim()

  const [rows, counts, requests] = await Promise.all([
    loadFirmRows(filter, q),
    prisma.searchFirm.groupBy({ by: ['matchStatus'], _count: { _all: true } }),
    prisma.searchRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { searchFirm: { select: { name: true } } } }),
  ])
  const count = (s: string) => counts.find((c) => c.matchStatus === s)?._count._all ?? 0
  const submitLink = `${appUrl()}${SUBMIT_SEARCH_PATH}`
  const exportHref = `/support/admin/crm/search-firms/export?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <div className="space-y-8">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← CRM</Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Search firms</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Firms with open searches, matched to the CRM: {count('MATCHED')} already there, {count('ADDED')} added,{' '}
          {count('REVIEW')} waiting on the{' '}
          <Link href="/support/admin/crm/needs-completion" className="underline">Review List</Link>. Contacts come from each
          firm&apos;s own team page. An address marked <span className="font-medium">guess</span> was worked out from the
          firm&apos;s format — check it before sending. Nothing here sends email.
        </p>
        <p className="text-sm">
          Submit link for recruiters: <a href={SUBMIT_SEARCH_PATH} className="text-primary underline">{submitLink}</a>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Searches sent in ({requests.length})</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. They arrive from {SUBMIT_SEARCH_PATH}; no reply is emailed automatically.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 p-4 text-sm">
                <p className="font-medium">
                  {r.roleTitle}
                  {r.confidential ? <span className="ml-2 text-xs font-medium text-warning">Confidential</span> : null}
                  <span className="ml-2 text-xs text-muted-foreground">{r.status.toLowerCase()}</span>
                </p>
                <p className="text-muted-foreground">
                  {[r.level, r.function, r.location, r.compensation].filter(Boolean).join(' · ') || 'No level, function or location given'}
                  {r.clientName ? ` · Client: ${r.clientName}${r.confidential ? ' (never shown to members)' : ''}` : ''}
                </p>
                <p>
                  {r.contactName}, {r.firmName}{r.searchFirm ? ` (known firm: ${r.searchFirm.name})` : ''} ·{' '}
                  <a href={`mailto:${r.contactEmail}`} className="underline">{r.contactEmail}</a>
                  {r.contactPhone ? ` · ${r.contactPhone}` : ''} · {r.createdAt.toLocaleDateString()}
                  {r.ref ? ` · via ${r.ref}` : ''}
                </p>
                {r.description && <p className="whitespace-pre-line text-muted-foreground">{r.description}</p>}
                <div className="flex gap-2 pt-1">
                  {(NEXT_STATUS[r.status] ?? []).map((n) => (
                    <form key={n.status} action={setSearchRequestStatus.bind(null, r.id, n.status)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">{n.label}</SubmitButton>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pitch drafts — for approval, not sent</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {PITCH_DRAFTS.map((p) => (
            <div key={p.segment} className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{SEGMENT_LABEL[p.segment]}</p>
                <CopyButton text={`Subject: ${p.subject}\n\n${p.body.replaceAll('{link}', `${submitLink}?ref=${p.segment}`)}`} />
              </div>
              <p className="text-muted-foreground">Subject: {p.subject}</p>
              <p className="whitespace-pre-line">{p.body}</p>
              <p className="text-xs text-muted-foreground">{wordCount(p.body)} words · edit in src/lib/search-firms/pitches.ts</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Firms ({rows.length})</h2>
          <a href={exportHref} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Download CSV
          </a>
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/support/admin/crm/search-firms">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which firms">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`/support/admin/crm/search-firms?filter=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${f.value === filter ? 'border-primary font-medium' : 'border-border text-muted-foreground'}`}
                aria-current={f.value === filter ? 'page' : undefined}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <input type="hidden" name="filter" value={filter} />
          <label htmlFor="firm-q" className="sr-only">Search firms</label>
          <input id="firm-q" name="q" defaultValue={q} placeholder="Firm name" className="h-8 rounded-md border border-input px-2 text-sm" />
        </form>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No firms here. Load them with scripts/search-firms/import.ts (see the comment at its top).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Firm</th>
                  <th className="p-2">Live searches</th>
                  <th className="p-2">CRM</th>
                  <th className="p-2">Best contacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="p-2">
                      <p className="font-medium">{r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.name}</a> : r.name}</p>
                      <p className="text-xs text-muted-foreground">{SEGMENT_LABEL[r.segment]}</p>
                    </td>
                    <td className="p-2">
                      <p className="tabular-nums">{r.liveSearchCount}</p>
                      {r.sampleTitles.length > 0 && <p className="text-xs text-muted-foreground">{r.sampleTitles.slice(0, 3).join(' · ')}</p>}
                    </td>
                    <td className="p-2">
                      {r.crmOrg ? (
                        <>
                          <Link href={`/support/admin/crm/organizations/${r.crmOrg.id}`} className="hover:underline">{r.crmOrg.name}</Link>
                          <p className="text-xs text-muted-foreground">{r.matchStatus === 'ADDED' ? 'Added — was not in CRM' : 'Already in CRM'}</p>
                        </>
                      ) : r.reviewOrg ? (
                        <SearchFirmReviewRow firmId={r.id} firmName={r.name} orgId={r.reviewOrg.id} orgName={r.reviewOrg.name} reason={r.reviewReason} compact />
                      ) : (
                        <span className="text-muted-foreground">Not in CRM</span>
                      )}
                    </td>
                    <td className="p-2">
                      {r.contacts.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {r.teamPageUrl ? 'No search contacts on the team page' : 'Team page not read yet'}
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {r.contacts.map((c) => (
                            <li key={c.personId}>
                              <Link href={`/support/admin/crm/people/${c.personId}`} className="hover:underline">{c.name}</Link>
                              <span className="text-muted-foreground"> · {c.title}</span>
                              <br />
                              {c.email ? (
                                <span className="text-xs">{c.email}</span>
                              ) : c.guessedEmail ? (
                                <span className="text-xs" title={c.guessedEmailBasis ?? undefined}>
                                  {c.guessedEmail} <span className="rounded bg-warning/15 px-1 font-medium text-warning">guess</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">No email</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
