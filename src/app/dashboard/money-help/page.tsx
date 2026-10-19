import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { PageHeader } from '@/components/candidate/PageHeader'
import { setMoneyHelp, deleteMoneyNumbers } from './actions'

export const metadata: Metadata = { title: 'Money help' }

const YES = ['How many months your money lasts', 'Deadlines you could miss: health coverage, unemployment, severance', 'Jobs filtered to a minimum pay you set', 'A calm way to talk it through with your partner']
const NO = ['We will not ask about past pay, savings or a minimum', 'No runway, and no money steps in your first week', 'Pay ranges on jobs still show, because they are not about you']

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-ink">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  )
}

// Where the member chooses whether NextChapter helps with money. Asked once, early, and changeable here.
export default async function MoneyHelpPage() {
  const profile = await getDashboardData()
  const on = profile.moneyHelp === true
  const off = profile.moneyHelp === false
  return (
    <div className="space-y-8">
      <PageHeader title="Money help" intro="Money is personal, so we only get into it if you want us to. Choose whether NextChapter helps with money. You can change this any time." />
      <p className="text-base font-semibold text-ink">{on ? 'Help with money is on.' : off ? 'Help with money is off.' : 'You have not chosen yet.'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <form action={setMoneyHelp} className={`space-y-3 rounded-2xl p-5 ${on ? 'border-2 border-ink' : 'border border-border'}`}>
          <input type="hidden" name="moneyHelp" value="yes" />
          <h2 className="font-display text-xl font-semibold text-ink">Yes, help me with money</h2>
          <List items={YES} />
          <button type="submit" disabled={on} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
            {on ? 'This is on' : 'Yes, turn it on'}
          </button>
          {on && <p className="text-sm text-muted-foreground">To turn it off, choose the other option.</p>}
        </form>
        <form action={setMoneyHelp} className={`space-y-3 rounded-2xl p-5 ${off ? 'border-2 border-ink' : 'border border-border'}`}>
          <input type="hidden" name="moneyHelp" value="no" />
          <h2 className="font-display text-xl font-semibold text-ink">No, keep money out of it</h2>
          <List items={NO} />
          <button type="submit" disabled={off} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
            {off ? 'This is on' : 'No, skip money'}
          </button>
          {off && <p className="text-sm text-muted-foreground">To turn help back on, choose the other option.</p>}
        </form>
      </div>
      <p className="text-sm text-muted-foreground">Nothing here is shared with employers, recruiters, schools or coaches.</p>
      <form action={deleteMoneyNumbers} className="text-sm text-muted-foreground">
        If you want, we can delete the pay and savings numbers you gave us.{' '}
        <button type="submit" className="font-medium text-brand underline underline-offset-4">
          Delete my money numbers
        </button>
      </form>
    </div>
  )
}
