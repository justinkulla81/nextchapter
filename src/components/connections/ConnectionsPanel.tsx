// Connected portals, the one panel both kinds of portal show: an organization's Admin › Connected organizations and an employer's
// Your network. Ordered by what to act on: requests waiting for your answer, then the connections you have and what each shares with
// you, then who you could connect with, then your own requests still waiting.

import { Network } from 'lucide-react'
import type { ConnectionsData, ConnectionView, SharedItems } from '@/lib/connections/connections'
import type { ConnState } from '@/lib/connections/form'
import { partyKey, SHARE_ITEMS, shareItemsFor } from '@/lib/connections/rules'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from '@/components/higher-ed/ConfirmActionButton'
import { AnswerRequest, RequestConnectionButton, ShareChoices } from './ConnectionForms'

type FormAction = (prev: ConnState, f: FormData) => Promise<ConnState>
export type ConnectionActions = { request: FormAction; decide: FormAction; shares: FormAction; end: (id: string) => Promise<{ error?: string }> }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const labelOf = (k: string) => SHARE_ITEMS.find((s) => s.key === k)?.label.toLowerCase() ?? k.toLowerCase()
const list = (keys: string[]) => (keys.length ? keys.map(labelOf).join(', ').replace(/, ([^,]*)$/, ' and $1') : 'nothing yet')

function Shared({ items, name }: { items: SharedItems; name: string }) {
  const none = !items.JOBS && !items.EVENTS && !items.LAYOFFS
  if (none) return <p className="text-sm text-muted-foreground">{name} shares nothing with you yet.</p>
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.JOBS && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</p>
          {items.JOBS.length ? (
            <ul className="mt-1 space-y-1 text-sm">
              {items.JOBS.map((j) => (
                <li key={j.id}>
                  {j.url ? <a href={j.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{j.title}</a> : <span className="font-medium">{j.title}</span>}
                  <span className="block text-xs text-muted-foreground">{[j.company, j.location].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">No jobs right now.</p>}
        </div>
      )}
      {items.EVENTS && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Events</p>
          {items.EVENTS.length ? (
            <ul className="mt-1 space-y-1 text-sm">
              {items.EVENTS.map((e) => (
                <li key={e.id}>
                  {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{e.title}</a> : <span className="font-medium">{e.title}</span>}
                  <span className="block text-xs text-muted-foreground">{[dateFmt.format(e.startsAt), e.location].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">No upcoming events.</p>}
        </div>
      )}
      {items.LAYOFFS && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layoffs they are responding to</p>
          {items.LAYOFFS.length ? (
            <ul className="mt-1 space-y-1 text-sm">
              {items.LAYOFFS.map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.employer}</span>
                  <span className="block text-xs text-muted-foreground">{[l.title, l.seats ? `${l.seats.toLocaleString('en-US')} people` : null, `since ${dateFmt.format(l.since)}`].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">No active layoff responses.</p>}
        </div>
      )}
    </div>
  )
}

function Who({ c }: { c: ConnectionView }) {
  return (
    <span className="text-sm">
      <span className="font-medium">{c.other.name}</span>
      <span className="ml-2 text-xs text-muted-foreground">{c.other.label}</span>
    </span>
  )
}

export function ConnectionsPanel({ data, actions, canEdit, q }: { data: ConnectionsData; actions: ConnectionActions; canEdit: boolean; q: string }) {
  const { me, incoming, outgoing, active, candidates } = data
  const myItems = shareItemsFor(me.kind).map((s) => ({ key: s.key, label: s.label, detail: s.detail }))
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Connect your portal with the organizations you work with: workforce boards, economic development, community groups, colleges and employers. Once the other side
        accepts, each of you chooses what to share with the other, and either side can change that or disconnect at any time. Nothing about individual people is shared.
      </p>

      {incoming.length > 0 && (
        <section aria-labelledby="conn-in" className="space-y-2 rounded-xl border border-orange/40 bg-orange/5 p-4">
          <h2 id="conn-in" className="text-base font-semibold">Waiting for your answer <span className="text-sm font-normal text-muted-foreground">{incoming.length}</span></h2>
          <ul className="divide-y divide-border">
            {incoming.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="space-y-0.5">
                  <Who c={c} />
                  <span className="block text-xs text-muted-foreground">Asked {dateFmt.format(c.since)}. Once you accept, each of you chooses what to share with the other.</span>
                </span>
                {canEdit ? <AnswerRequest action={actions.decide} id={c.id} name={c.other.name} /> : <span className="text-xs text-muted-foreground">An administrator answers this.</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="conn-active" className="space-y-3">
        <h2 id="conn-active" className="text-base font-semibold">Connected <span className="text-sm font-normal text-muted-foreground">{active.length}</span></h2>
        {active.length ? (
          <ul className="space-y-4">
            {active.map((c) => (
              <li key={c.id} className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Who c={c} />
                  <span className="text-xs text-muted-foreground">Connected {dateFmt.format(c.since)} · they share {list(c.theirShares)}</span>
                </div>
                <Shared items={c.shared} name={c.other.name} />
                {canEdit ? (
                  <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-3">
                    <ShareChoices action={actions.shares} id={c.id} items={myItems} current={c.myShares} name={c.other.name} />
                    <ConfirmActionButton label="Disconnect" variant="outline" confirm={`Disconnect from ${c.other.name}? Neither of you will see what the other shared.`} confirmLabel="Disconnect" run={actions.end.bind(null, c.id)} />
                  </div>
                ) : (
                  <p className="border-t border-border pt-3 text-xs text-muted-foreground">You share {list(c.myShares)}.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Network} title="No connected portals yet" description="Ask an organization below to connect. Once it accepts, what it shares shows here." />
        )}
      </section>

      {canEdit && (
        <section aria-labelledby="conn-find" className="space-y-3">
          <h2 id="conn-find" className="text-base font-semibold">Connect with</h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="conn-q">Organization or employer on NextChapter</Label>
              <Input id="conn-q" name="q" defaultValue={q} placeholder="e.g. KentuckianaWorks" className="w-72" />
            </div>
            <Button type="submit" variant="outline">Search portals</Button>
          </form>
          {candidates.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {candidates.map((c) => (
                <li key={partyKey(c)} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span className="text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.label} · {c.why}</span>
                  </span>
                  <RequestConnectionButton action={actions.request} other={partyKey(c)} name={c.name} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {q ? `No portal on NextChapter matches “${q}”. Organizations without a portal yet can be invited from Related organizations.` : 'Organizations you linked that have their own portal show here. Search to find any other portal on NextChapter.'}
            </p>
          )}
        </section>
      )}

      {outgoing.length > 0 && (
        <section aria-labelledby="conn-out" className="space-y-2">
          <h2 id="conn-out" className="text-base font-semibold">Your requests</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {outgoing.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="space-y-0.5">
                  <Who c={c} />
                  <span className="block text-xs text-muted-foreground">Asked {dateFmt.format(c.since)}, waiting for them to accept</span>
                </span>
                {canEdit && <ConfirmActionButton label="Withdraw" variant="outline" confirm={`Withdraw your request to ${c.other.name}?`} confirmLabel="Withdraw" run={actions.end.bind(null, c.id)} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
