'use client'

import Link from 'next/link'
import { CrmSignupMatchActions } from '@/components/admin/CrmSignupMatchActions'

export interface NextChapterAccountInfo {
  account: { href: string; since: string } | null
  invitedAt: string | null
  possibleSignups: { matchId: string; name: string; email: string | null; signedUp: string; sameEmail: boolean }[]
}

/**
 * Whether this CRM person has a NextChapter candidate account — a checked
 * box when they do — and any sign-up that looks like them, confirmable
 * right here as well as on the Review List.
 */
export function CrmNextChapterAccount({ info, onChanged, membership }: { info: NextChapterAccountInfo; onChanged?: () => void; membership?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2">
        <input type="checkbox" checked={!!info.account} readOnly aria-label="Has a NextChapter candidate account" className="h-4 w-4 accent-primary" />
        {info.account ? (
          <span>
            NextChapter candidate account ·{' '}
            <Link href={info.account.href} className="text-primary underline underline-offset-4">view</Link>
            <span className="text-muted-foreground"> · signed up {info.account.since}{membership ? ` · ${membership}` : ''}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            No NextChapter account{info.invitedAt ? ` · invited ${info.invitedAt}` : ''}
          </span>
        )}
      </p>

      {info.possibleSignups.map((m) => (
        <div key={m.matchId} className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p>
            <span className="font-medium">Possible sign-up:</span> {m.name}
            {m.email ? ` · ${m.email}` : ''} · {m.signedUp}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.sameEmail ? 'Same email as this record.' : 'Similar name — check it’s the same person.'}
          </p>
          <div className="mt-2"><CrmSignupMatchActions matchId={m.matchId} onChanged={onChanged} /></div>
        </div>
      ))}
    </div>
  )
}
