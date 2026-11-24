import { addressVerdict } from '@/lib/mailing/address-check'

/** True when Hunter's last word on the address was anything but deliverable (risky, accept-all, unknown, invalid). Owner, 2026-11-24: kept, never emailed. */
export const isUnsendable = (status: string | null | undefined) => addressVerdict(status, false) === 'skip'

/** A small flag beside a contact's email when we do not email that address. Renders nothing for a deliverable or unchecked one. */
export function CrmEmailRiskFlag({ status }: { status: string | null | undefined }) {
  if (!isUnsendable(status)) return null
  const label = (status ?? '').toLowerCase() === 'risky' || (status ?? '').toLowerCase() === 'accept_all' ? 'risky' : (status ?? '').toLowerCase()
  return (
    <span
      title="Hunter could not confirm this inbox, so we don't email it: no list email and no outreach from here. Kept on record so their emails still match."
      className="ml-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
    >
      {label}: not emailed
    </span>
  )
}
