import Link from 'next/link'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface PriorityContactItem {
  id: string
  name: string
  company: string | null
  title: string | null
}

// Starred contacts the candidate hasn't reached out to yet — see
// toggleContactPriority in network/actions.ts for why a contact drops off
// this list (and starts showing in Needs a Follow-up instead) the moment an
// outreach is logged. Starring itself happens on the Contact Book, not
// here — this card is a reminder, not a management surface.
export function PriorityContactsCard({ contacts }: { contacts: PriorityContactItem[] }) {
  if (contacts.length === 0) return null

  return (
    <Card id="priority-contacts" className="scroll-mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Star className="size-3.5" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium text-muted-foreground">Priority contacts</CardTitle>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People you&apos;ve starred as most important to reach out to.{' '}
          <Link href="/dashboard/network/contacts" className="underline hover:text-foreground">
            Manage in your Contact Book
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent className="py-0">
        {contacts.map((contact, i) => (
          <div
            key={contact.id}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5 text-sm',
              i !== contacts.length - 1 && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{contact.name}</p>
              {(contact.title || contact.company) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[contact.title, contact.company].filter(Boolean).join(' at ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
