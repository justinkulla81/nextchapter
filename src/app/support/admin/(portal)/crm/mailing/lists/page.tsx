import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getMailingSettings } from '@/lib/mailing/lists'
import { SubmitButton } from '@/components/ui/submit-button'
import { saveList, saveSettings, setListActive } from '../actions'
import { MailingGroupBuilder } from '@/components/admin/mailing/MailingGroupBuilder'

const input = 'h-8 w-full rounded border border-input bg-transparent px-2 text-sm'

export default async function MailingListsPage() {
  await requireAdmin()
  const [lists, settings, counts] = await Promise.all([
    prisma.mailingList.findMany({ orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }] }),
    getMailingSettings(),
    prisma.mailingListMember.groupBy({ by: ['listId', 'status'], _count: true }),
  ])
  const countFor = (listId: string, status: string) => counts.find((c) => c.listId === listId && c.status === status)?._count ?? 0

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/mailing" className="text-sm text-muted-foreground hover:underline">← Monthly Update and mailing lists</Link>
        <h1 className="text-2xl font-semibold">Lists and sender settings</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lists</h2>
        {lists.map((l) => (
          <form key={l.id} action={saveList} className={`grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] ${l.isActive ? '' : 'opacity-60'}`}>
            <input type="hidden" name="id" value={l.id} />
            <label className="text-xs">
              <span className="mb-1 block font-medium">Name</span>
              <input name="name" defaultValue={l.name} required className={input} />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {l.key} · {countFor(l.id, 'ACTIVE')} subscribed · {countFor(l.id, 'UNSUBSCRIBED')} unsubscribed
                {countFor(l.id, 'BOUNCED') + countFor(l.id, 'COMPLAINED') > 0 ? ` · ${countFor(l.id, 'BOUNCED') + countFor(l.id, 'COMPLAINED')} bounced or complained` : ''}
                {!l.isActive && ' · archived'}
              </span>
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium">Who it&apos;s for</span>
              <input name="audience" defaultValue={l.audience ?? ''} className={input} />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium">Description <span className="font-normal text-muted-foreground">shown on the unsubscribe page</span></span>
              <input name="description" defaultValue={l.description ?? ''} className={input} />
              <input type="hidden" name="defaultFromName" value={l.defaultFromName ?? ''} />
            </label>
            <div className="flex items-end gap-2">
              <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Save</SubmitButton>
              <SubmitButton size="sm" variant="ghost" formAction={setListActive.bind(null, l.id, !l.isActive)} pendingLabel="…">
                {l.isActive ? 'Archive' : 'Restore'}
              </SubmitButton>
            </div>
          </form>
        ))}
        <form action={saveList} className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="text-xs"><span className="mb-1 block font-medium">New list name</span><input name="name" required className={input} /></label>
          <label className="text-xs"><span className="mb-1 block font-medium">Who it&apos;s for</span><input name="audience" className={input} /></label>
          <label className="text-xs"><span className="mb-1 block font-medium">Description</span><input name="description" className={input} /></label>
          <div className="flex items-end"><SubmitButton size="sm" pendingLabel="Adding…">Add list</SubmitButton></div>
        </form>
        <p className="text-xs text-muted-foreground">Archiving a list hides it everywhere but keeps who was on it and everything sent to it.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add or remove people in bulk</h2>
        <MailingGroupBuilder
          lists={lists.filter((l) => l.isActive).map((l) => ({ id: l.id, key: l.key, name: l.name, audience: l.audience }))}
          defaultListIds={lists.filter((l) => l.key === 'monthly_update').map((l) => l.id)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sender settings</h2>
        <form action={saveSettings} className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <label className="text-xs"><span className="mb-1 block font-medium">From name</span><input name="fromName" defaultValue={settings.fromName} className={input} /></label>
          <label className="text-xs">
            <span className="mb-1 block font-medium">From address</span>
            <input name="fromEmail" defaultValue={settings.fromEmail} className={input} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Its domain must be verified in Resend. A separate updates. subdomain keeps list mail from affecting your everyday email.</span>
          </label>
          <label className="text-xs"><span className="mb-1 block font-medium">Replies go to</span><input name="replyTo" defaultValue={settings.replyTo} className={input} /></label>
          <label className="text-xs"><span className="mb-1 block font-medium">Test emails go to</span><input name="testEmail" defaultValue={settings.testEmail} className={input} /></label>
          <label className="text-xs"><span className="mb-1 block font-medium">Emails per hour</span><input name="ratePerHour" type="number" min={1} max={2000} defaultValue={settings.ratePerHour} className={input} /></label>
          <label className="text-xs">
            <span className="mb-1 block font-medium">Postal address <span className="font-normal text-muted-foreground">required by law in every list email</span></span>
            <input name="postalAddress" defaultValue={settings.postalAddress} placeholder="Street, city, state ZIP (a PO box works)" className={input} />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block font-medium">Footer line</span>
            <input name="footerText" defaultValue={settings.footerText} className={input} />
            <span className="mt-1 block text-[11px] text-muted-foreground">The words in [brackets] become the unsubscribe link; {'{{postalAddress}}'} becomes the address above.</span>
          </label>
          <div><SubmitButton pendingLabel="Saving…">Save settings</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
