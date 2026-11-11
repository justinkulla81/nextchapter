'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { ORG_SEGMENTS, type OrgSegmentKey } from '@/lib/mailing/org-segments'

export interface EditionRecipientRow {
  id: string
  personId: string | null
  name: string | null
  email: string
  added: boolean
  status: string
  error: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  openCount: number
  clickedAt: string | null
  clickCount: number
  bouncedAt: string | null
  bounceDetail: string | null
  unsubscribedAt: string | null
  repliedAt: string | null
  /** Set on the all-people page, where one table holds every version of the mailing. */
  version?: string
  /** Their current organization, and the kinds of organization they work at (see org-segments). */
  orgName: string | null
  segments: string[]
}

type Filter = keyof typeof FILTERS
const FILTERS = {
  all: { label: 'Everyone', test: () => true },
  delivered: { label: 'Delivered', test: (r: EditionRecipientRow) => !!r.deliveredAt },
  not_delivered: { label: 'Not delivered', test: (r: EditionRecipientRow) => !r.deliveredAt },
  opened: { label: 'Opened', test: (r: EditionRecipientRow) => !!r.openedAt },
  not_opened: { label: 'Not opened', test: (r: EditionRecipientRow) => !r.openedAt },
  clicked: { label: 'Clicked', test: (r: EditionRecipientRow) => !!r.clickedAt },
  not_clicked: { label: 'Not clicked', test: (r: EditionRecipientRow) => !r.clickedAt },
  replied: { label: 'Replied', test: (r: EditionRecipientRow) => !!r.repliedAt },
  not_replied: { label: 'Not replied', test: (r: EditionRecipientRow) => !r.repliedAt },
  bounced: { label: 'Bounced', test: (r: EditionRecipientRow) => !!r.bouncedAt },
  unsubscribed: { label: 'Unsubscribed', test: (r: EditionRecipientRow) => !!r.unsubscribedAt },
  failed: { label: 'Failed', test: (r: EditionRecipientRow) => r.status === 'FAILED' },
} satisfies Record<string, { label: string; test: (r: EditionRecipientRow) => boolean }>

type SortKey = 'version' | 'name' | 'orgName' | 'email' | 'sentAt' | 'deliveredAt' | 'openCount' | 'clickCount' | 'bouncedAt' | 'unsubscribedAt' | 'repliedAt'
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'orgName', label: 'Organization' },
  { key: 'email', label: 'Email' },
  { key: 'sentAt', label: 'Sent' },
  { key: 'deliveredAt', label: 'Delivered' },
  { key: 'openCount', label: 'Human opens (approx.)' },
  { key: 'clickCount', label: 'Clicks' },
  { key: 'repliedAt', label: 'Replied' },
  { key: 'bouncedAt', label: 'Bounced' },
  { key: 'unsubscribedAt', label: 'Unsubscribed' },
]

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

/** The sent dashboard's recipient list: search, filter by what each person did, sort any column. */
export function EditionRecipientsTable({ editionId, rows, allVersions = false }: { editionId: string; rows: EditionRecipientRow[]; allVersions?: boolean }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [segment, setSegment] = useState<'all' | OrgSegmentKey | 'none'>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(allVersions ? { key: 'sentAt', dir: -1 } : { key: 'name', dir: 1 })
  const columns = allVersions ? [{ key: 'version' as SortKey, label: 'Version' }, ...COLUMNS] : COLUMNS

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const inSegment = (r: EditionRecipientRow) => segment === 'all' || (segment === 'none' ? r.segments.length === 0 : r.segments.includes(segment))
    const out = rows.filter((r) => FILTERS[filter].test(r) && inSegment(r) && (!needle || `${r.name ?? ''} ${r.orgName ?? ''} ${r.email}`.toLowerCase().includes(needle)))
    const val = (r: EditionRecipientRow): string | number => {
      const v = sort.key === 'name' ? r.name ?? r.email : sort.key === 'version' ? r.version : sort.key === 'orgName' ? r.orgName : r[sort.key]
      return typeof v === 'number' ? v : (v ?? '').toLowerCase()
    }
    return out.sort((a, b) => {
      const x = val(a), y = val(b)
      // Blanks always sink, whichever way the column is sorted.
      if (x === '' && y !== '') return 1
      if (y === '' && x !== '') return -1
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [rows, q, filter, segment, sort])

  const sortBy = (key: SortKey) => {
    // Counts and dates read best biggest/newest first; names A–Z.
    const firstDir = key === 'name' || key === 'email' || key === 'orgName' ? 1 : -1
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: firstDir }))
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{allVersions ? 'Everyone in this mailing, all versions' : 'Recipients'}</h2>
        <Link href={`/support/admin/crm/mailing/editions/${editionId}/export${allVersions ? '?all=1' : ''}`} prefetch={false} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Download CSV
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="sr-only">Search recipients</span>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email"
            className="h-9 w-64 rounded-lg border border-input bg-transparent px-3"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Show</span>
          <select
            value={filter}
            onChange={(e) => { const f = e.target.value as Filter; setFilter(f); posthog.capture('mailing_recipients_filtered', { editionId, filter: f }) }}
            className="h-9 rounded-lg border border-input bg-transparent px-2"
          >
            {Object.entries(FILTERS).map(([k, f]) => (
              <option key={k} value={k}>{`${f.label} (${rows.filter(f.test).length})`}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Organization type</span>
          <select
            value={segment}
            onChange={(e) => { const s = e.target.value as typeof segment; setSegment(s); posthog.capture('mailing_recipients_org_type_filtered', { editionId, segment: s }) }}
            className="h-9 rounded-lg border border-input bg-transparent px-2"
          >
            <option value="all">{`All organizations (${rows.length})`}</option>
            {ORG_SEGMENTS.map((s) => (
              <option key={s.key} value={s.key}>{`${s.label} (${rows.filter((r) => r.segments.includes(s.key)).length})`}</option>
            ))}
            <option value="none">{`No organization on file (${rows.filter((r) => r.segments.length === 0).length})`}</option>
          </select>
        </label>
        <span className="text-muted-foreground">{visible.length} of {rows.length}</span>
      </div>
      <div className="max-h-[40rem] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => sortBy(c.key)} className="hover:underline">
                    {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">Nobody matches.</td></tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-border">
                {allVersions && <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{r.version}</td>}
                <td className="px-3 py-1.5">
                  {r.personId ? <Link href={`/support/admin/crm/people/${r.personId}`} target={allVersions ? '_blank' : undefined} rel={allVersions ? 'noreferrer' : undefined} className="hover:underline">{r.name ?? r.email}</Link> : '—'}
                  {r.added && <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand">added</span>}
                </td>
                <td className="max-w-[28ch] truncate px-3 py-1.5" title={r.orgName ?? undefined}>{r.orgName ?? ''}</td>
                <td className="px-3 py-1.5">{r.email}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{r.status === 'SENT' ? when(r.sentAt) : r.status === 'FAILED' ? <span className="text-destructive" title={r.error ?? ''}>Failed</span> : r.status === 'SKIPPED' ? 'Skipped' : 'Waiting'}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{when(r.deliveredAt)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" title={r.openedAt ? `First opened ${when(r.openedAt)}` : ''}>{r.openCount || ''}</td>
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" title={r.clickedAt ? `First clicked ${when(r.clickedAt)}` : ''}>{r.clickCount || ''}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{when(r.repliedAt)}</td>
                <td className="px-3 py-1.5 text-xs" title={r.bounceDetail ?? ''}>{when(r.bouncedAt)}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{when(r.unsubscribedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
