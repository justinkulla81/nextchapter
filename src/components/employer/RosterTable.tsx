'use client'

import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { markSeatPlacedAction, deactivateSeatAction } from '@/app/employer/(app)/roster/actions'
import type { RosterSeat } from '@/lib/employer/outplacement-roster'
import { SeatPackageSelect } from './ProgramForms'
import { SeatAccessControls } from './SeatAccessControls'

const STATUS_LABEL: Record<RosterSeat['status'], string> = {
  INVITED: 'Invited',
  ACTIVATED: 'Activated',
  DEACTIVATED: 'Deactivated',
}

function fmt(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

// Admin-only enrollment roster — reads only OutplacementSeat's own fields
// (see outplacement-roster.ts's file-level comment for why that's not a
// privacy-guard violation) and never a candidate's grade/activity/
// confidential status. `isSelf` rows are pre-redacted server-side.
// `packages`: the program's packages plus Everyone; the column shows only when there's a choice.
export function RosterTable({ seats, packages = [] }: { seats: RosterSeat[]; packages?: { key: string; name: string }[] }) {
  if (seats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No one has been enrolled yet.{' '}
        <a href="/employer/enroll" className="font-medium text-foreground underline underline-offset-4">
          Enroll people
        </a>{' '}
        one at a time or from a spreadsheet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {packages.length > 1 && <th className="px-3 py-2 font-medium">Package</th>}
            <th className="px-3 py-2 font-medium">Access</th>
            <th className="px-3 py-2 font-medium">Method</th>
            <th className="px-3 py-2 font-medium">Enrolled</th>
            <th className="px-3 py-2 font-medium">Activated</th>
            <th className="px-3 py-2 font-medium">Placed</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {seats.map((seat) => (
            <tr key={seat.id} className="border-t border-border">
              <td className="min-w-40 px-3 py-2">
                {seat.invitedName ?? '—'}
                {(seat.cohort || seat.externalId) && <span className="block text-xs text-muted-foreground">{[seat.cohort, seat.externalId && `ID ${seat.externalId}`].filter(Boolean).join(' · ')}</span>}
              </td>
              <td className="px-3 py-2">{seat.invitedEmail}</td>
              <td className="px-3 py-2">{STATUS_LABEL[seat.status]}</td>
              {packages.length > 1 && (
                <td className="px-3 py-2">
                  {seat.isSelf || seat.status === 'DEACTIVATED' ? (packages.find((p) => p.key === (seat.packageKey ?? 'all'))?.name ?? '—') : <SeatPackageSelect seatId={seat.id} value={seat.packageKey ?? 'all'} options={packages} />}
                </td>
              )}
              <td className="px-3 py-2">{seat.isSelf || seat.status === 'DEACTIVATED' ? '—' : <SeatAccessControls seat={seat} />}</td>
              <td className="px-3 py-2 text-muted-foreground">{seat.enrollmentMethod === 'BULK_CSV' ? 'Spreadsheet' : seat.enrollmentMethod === 'API' ? 'HR system' : 'Single'}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(seat.enrolledAt)}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(seat.activatedAt)}</td>
              <td className="px-3 py-2 tabular-nums">{fmt(seat.placedAt)}</td>
              <td className="px-3 py-2">
                {seat.isSelf ? (
                  <span className="text-xs text-muted-foreground">Restricted</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {seat.status === 'ACTIVATED' && !seat.placedAt && (
                      <form action={markSeatPlacedAction.bind(null, seat.id)}>
                        <SubmitButton variant="outline" size="sm" pendingLabel="Marking…">
                          Mark placed
                        </SubmitButton>
                      </form>
                    )}
                    {seat.status !== 'DEACTIVATED' && (
                      <ConfirmForm
                        action={deactivateSeatAction.bind(null, seat.id)}
                        confirmMessage={`Deactivate the seat for ${seat.invitedName ?? seat.invitedEmail}? They'll lose access to this benefit.`}
                      >
                        <SubmitButton variant="destructive" size="sm" pendingLabel="Deactivating…">
                          Deactivate
                        </SubmitButton>
                      </ConfirmForm>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
